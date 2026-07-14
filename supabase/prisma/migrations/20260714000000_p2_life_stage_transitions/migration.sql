-- P2: 생애주기 전환 처리 (Flow-SYS-05 성년 전환 / Flow-SYS-06 청소년 전환기 진입)
-- 참조: docs/04-workflow.md Flow-SYS-05/06, docs/05-erd.md §2-2-1(get_life_stage/파생값)
-- 작성: backend-db
--
-- 설계 메모:
--   - life_stage(아동기/청소년전환기/성년기)는 birth_date 파생값이라 저장하지 않는다.
--     단, 성년 여부만 persons.is_adult(boolean) 로 물질화되어 있어 동의 주체 이관 등에 쓰인다.
--   - Edge Function(Deno)을 새로 만들지 않고, 이 프로젝트의 기존 컨벤션(plpgsql 함수 + SQL 레이어)에
--     맞춰 pg_cron + plpgsql 로 구현한다. 순수 SQL 이라 pgTAP(10_*.sql)으로 함수 자체를 검증 가능.
--   - 성년 전환은 is_adult=false 가드가 자연스러운 idempotency 장치다(cron 다운타임 캐치업 겸용).
--   - 청소년 전환기는 물질화 컬럼이 없으므로 "만 14세인 기간(1년) 전체"를 대상 범위로 잡되,
--     notifications에 이미 동일 (recipient, type, person_id) 알림이 있으면 재발송하지 않는
--     NOT EXISTS 가드로 1인당 평생 1회만 발화한다(생일 당일에 한정하면 cron 다운타임 시
--     영구 누락되므로, 캐치업 가능하면서도 중복 없는 이 방식을 택했다).

-- =========================================================================
-- 1. NotificationType enum 값 추가
--    (PostgreSQL 12+ 는 트랜잭션 내 ADD VALUE 허용. 새 값을 "같은 트랜잭션에서 사용"하지만 않으면
--     안전하며, 아래 함수는 enum 리터럴을 런타임에 해석하므로 마이그레이션 커밋 후에야 사용된다.)
-- =========================================================================
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'life_stage_youth';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'life_stage_adult';

-- =========================================================================
-- 2. 전환 처리 함수 — cron 전용, SECURITY DEFINER 로 RLS 우회하여 전 당사자 갱신
-- =========================================================================
CREATE OR REPLACE FUNCTION process_life_stage_transitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- ── 성년 전환(만 18세) ─────────────────────────────────────────────────
  --   is_adult=false 이고 만 18세 도달(정확한 생일뿐 아니라 다운타임으로 놓친 과거분도 캐치업)한
  --   당사자를 성년으로 승격하고, 주보호자(= 셀프 가입 시 본인 계정)에게 알림.
  --   is_adult=false 가드가 재실행 시 중복 승격/알림을 막는다(idempotent).
  WITH promoted AS (
    UPDATE persons
       SET is_adult = true,
           updated_at = now()
     WHERE is_adult = false
       AND birth_date <= (CURRENT_DATE - INTERVAL '18 years')::date
    RETURNING id, full_name, primary_guardian_id
  )
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT primary_guardian_id,
         'life_stage_adult',
         '성년 전환 안내',
         full_name || '님이 성년(만 18세)이 되어 동의 주체 이관 절차가 시작됩니다.',
         jsonb_build_object('person_id', id)
    FROM promoted;

  -- ── 청소년 전환기 진입(만 14세) — 보호자 알림 ──────────────────────────
  --   물질화 컬럼이 없어 "생일 당일"뿐 아니라 만 14세인 기간 전체를 대상 범위로 잡되,
  --   NOT EXISTS로 같은 person_id에게 이미 보낸 적 있는지 확인해 1인당 평생 1회만 발화한다.
  --   이렇게 하면 (a) cron이 생일 당일을 놓쳐도 다음 실행에서 캐치업되고,
  --   (b) 같은 날 함수가 중복 호출돼도 알림이 중복 생성되지 않는다(is_adult=false 가드와 동일 사상).
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT p.primary_guardian_id,
         'life_stage_youth',
         '청소년 전환기 진입 안내',
         p.full_name || '님이 만 14세가 되어 전환계획 수립이 필요합니다.',
         jsonb_build_object('person_id', p.id)
    FROM persons p
   WHERE date_part('year', age(p.birth_date)) = 14
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.recipient_id = p.primary_guardian_id
          AND n.type = 'life_stage_youth'
          AND n.data->>'person_id' = p.id::text
     );

  -- ── 청소년 전환기 진입(만 14세) — 담당 특수교사 알림 ────────────────────
  --   해당 당사자에 EDU 도메인 활성 권한을 가진 grantee 중 role='teacher' 인 사용자.
  --   위와 동일하게 (교사, person) 조합 단위로 NOT EXISTS 중복 방지.
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT perm.grantee_id,
         'life_stage_youth',
         '담당 당사자 전환기 진입 안내',
         per.full_name || '님이 만 14세가 되어 전환계획이 활성화됩니다.',
         jsonb_build_object('person_id', per.id)
    FROM persons per
    JOIN permissions perm ON perm.person_id = per.id
    JOIN users u          ON u.id = perm.grantee_id
   WHERE date_part('year', age(per.birth_date)) = 14
     AND perm.domain = 'EDU'
     AND perm.is_active = true
     AND (perm.valid_until IS NULL OR perm.valid_until >= CURRENT_DATE)
     AND u.role = 'teacher'
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.recipient_id = perm.grantee_id
          AND n.type = 'life_stage_youth'
          AND n.data->>'person_id' = per.id::text
     );
END;
$fn$;

-- cron 전용: 일반(authenticated) 사용자의 직접 호출 차단.
REVOKE ALL ON FUNCTION process_life_stage_transitions() FROM PUBLIC;

-- =========================================================================
-- 3. pg_cron 스케줄 (매일 자정 UTC)
--    로컬 등 pg_cron 미탑재(shared_preload_libraries 부재) 환경에서도 마이그레이션이
--    실패하지 않도록 DO 블록으로 감싸고, 실패 시 함수/enum 은 그대로 두고 스케줄만 건너뛴다.
-- =========================================================================
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'life-stage-transitions-daily') THEN
    PERFORM cron.unschedule('life-stage-transitions-daily');
  END IF;

  PERFORM cron.schedule('life-stage-transitions-daily', '0 0 * * *',
                        'SELECT process_life_stage_transitions();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron 스케줄 등록 건너뜀(pg_cron 미탑재 환경 추정): %', SQLERRM;
END
$cron$;
