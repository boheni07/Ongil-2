-- P3: 권한 자동 만료 배치 + D-7 사전 알림 + 분기 미사용 권한 감사 요약 (F-G-10)
-- 참조: docs/01-prd.md F-G-10, docs/05-erd.md §4-5③⑤
-- 작성: backend-db
--
-- 설계 메모:
--   - Edge Function 을 새로 만들지 않는다. 이 두 배치는 notifications 에 INSERT 만 하고,
--     실제 FCM/Resend 발송은 기존 supabase/functions/dispatch-notification(알림 발송
--     라운드 20260714030000)이 담당한다. life_stage_transitions(20260714000000)와 동일하게
--     pg_cron + plpgsql 로 구현한다.
--   - is_active=false UPDATE 는 두 기존 트리거를 자동으로 탄다:
--       (a) trg_zz_invalidate_permission_cache(20260715000000) — WHEN 절이 is_active 변경을
--           커버하므로 캐시 무효화가 자동 발동한다. 추가 무효화 코드 불필요.
--       (b) trg_permission_audit(AFTER INSERT OR UPDATE ON permissions) — is_active
--           false&&old true → 'revoke' 감사 로그를 자동 기록한다. 별도 로그 INSERT 불필요.
--   - 두 함수 모두 cron 전용. SECURITY DEFINER 로 RLS 를 우회해 전(全) 당사자 대상 배치
--     UPDATE/집계를 수행하고, REVOKE ALL ... FROM PUBLIC 로 일반(authenticated) 직접 호출을
--     차단한다(life_stage_transitions 와 동일 잠금 패턴).
--
-- ⚠️ 범위 제외(후속 작업): PRD F-G-10 은 "과다권한" 요약도 언급하나, 과다권한 판정 기준이
--   아직 정의되지 않았고 이번 요청 범위(미사용 권한 요약)에 포함되지 않는다. 별도 후속 작업으로
--   남긴다 — 이 마이그레이션은 "90일 미사용 권한" 요약만 발송한다.

-- =========================================================================
-- 1. NotificationType enum 값 추가
--    (notifications.type / notification_preferences.type 공용 enum 이므로, 이 ADD VALUE 하나로
--     두 테이블 모두 새 타입을 허용한다 — 별도 CHECK 제약 없음. life_stage_transitions 와 동일하게
--     같은 트랜잭션에서 값을 "사용"하지 않으므로 안전하다; 함수는 enum 리터럴을 런타임에 해석하며
--     마이그레이션 커밋 후에야 실행된다.)
-- =========================================================================
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'permission_expiry_warning';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'permission_audit_summary';

-- =========================================================================
-- 2. 일 1회 배치 — 만료 처리 + D-7 사전 알림
--    cron 전용, SECURITY DEFINER 로 RLS 우회하여 전 당사자 대상 처리.
-- =========================================================================
CREATE OR REPLACE FUNCTION process_permission_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- ── ① 만료 처리 ────────────────────────────────────────────────────────
  --   valid_until 이 지난 활성 권한을 비활성화한다. is_active=true 가드가 재실행 시
  --   중복 처리를 막는다(idempotent; cron 다운타임 캐치업 겸용). 이 UPDATE 는
  --   trg_zz_invalidate_permission_cache(캐시 무효화) + trg_permission_audit('revoke'
  --   감사 로그) 두 트리거를 자동으로 발동시킨다 — 여기서 별도 처리 불필요.
  UPDATE permissions
     SET is_active  = false,
         updated_at = now()
   WHERE is_active = true
     AND valid_until IS NOT NULL
     AND valid_until < CURRENT_DATE;

  -- ── ② D-7 사전 알림 ────────────────────────────────────────────────────
  --   정확히 7일 후 만료되는 활성 권한에 대해 주보호자(guardians.is_primary=true)에게 알림.
  --   중복 방지: 같은 (recipient, permission_id) 조합의 permission_expiry_warning 이 이미
  --   있으면 재발송하지 않는다(life_stage_transitions 의 NOT EXISTS 가드 패턴 재사용) —
  --   같은 날 함수가 중복 호출돼도 알림이 중복 생성되지 않는다.
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT g.user_id,
         'permission_expiry_warning',
         '권한 만료 예정 안내',
         per.full_name || '님에 대한 ' || p.domain::text || ' 권한이 7일 후('
           || p.valid_until::text || ') 만료됩니다.',
         jsonb_build_object(
           'permission_id', p.id,
           'person_id',     p.person_id,
           'grantee_id',    p.grantee_id,
           'domain',        p.domain::text,
           'valid_until',   p.valid_until::text
         )
    FROM permissions p
    JOIN persons   per ON per.id = p.person_id
    JOIN guardians g   ON g.person_id = p.person_id AND g.is_primary = true
   WHERE p.is_active = true
     AND p.valid_until = (CURRENT_DATE + INTERVAL '7 days')::date
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.recipient_id = g.user_id
          AND n.type = 'permission_expiry_warning'
          AND n.data->>'permission_id' = p.id::text
     );
END;
$fn$;

-- cron 전용: 일반(authenticated) 사용자의 직접 호출 차단.
REVOKE ALL ON FUNCTION process_permission_expiry() FROM PUBLIC;

-- =========================================================================
-- 3. 분기 1회 배치 — 90일 미사용 권한 감사 요약
--    person 별로 미사용 활성 권한 수를 집계해 주보호자에게 요약 알림.
--    cron 전용, SECURITY DEFINER.
-- =========================================================================
CREATE OR REPLACE FUNCTION send_permission_audit_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- 미사용 권한 = 활성 권한이지만 최근 90일간 해당 grantee 가 그 당사자에 접근한
  -- access_logs 기록이 없는 것. person 별로 집계해 주보호자(is_primary=true)에게 발송.
  --
  -- 중복 방지: 분기 배치라 재발송 위험은 낮으나, 같은 날/분기 내 재실행 시 중복 삽입을
  -- 막기 위해 최근 80일 내 같은 (recipient, person) 요약이 있으면 스킵한다(분기 = 약 90일
  -- 이므로 80일 창은 이번 분기 재실행만 걸러내고 다음 분기 발송은 허용).
  --
  -- ⚠️ 과다권한 요약은 이번 범위에서 제외(위 파일 상단 주석 참조) — 미사용 권한만 집계한다.
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT g.user_id,
         'permission_audit_summary',
         '미사용 권한 정기 점검 안내',
         per.full_name || '님에 대해 90일간 사용되지 않은 권한이 '
           || unused.unused_count::text || '건 있습니다. 회수 여부를 검토해 주세요.',
         jsonb_build_object(
           'person_id',    unused.person_id,
           'unused_count', unused.unused_count
         )
    FROM (
      SELECT p.person_id, count(*) AS unused_count
        FROM permissions p
       WHERE p.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM access_logs a
            WHERE a.person_id = p.person_id
              AND a.actor_id  = p.grantee_id
              AND a.accessed_at > now() - INTERVAL '90 days'
         )
       GROUP BY p.person_id
    ) unused
    JOIN persons   per ON per.id = unused.person_id
    JOIN guardians g   ON g.person_id = unused.person_id AND g.is_primary = true
   WHERE NOT EXISTS (
     SELECT 1 FROM notifications n
      WHERE n.recipient_id = g.user_id
        AND n.type = 'permission_audit_summary'
        AND n.data->>'person_id' = unused.person_id::text
        AND n.sent_at > now() - INTERVAL '80 days'
   );
END;
$fn$;

-- cron 전용: 일반(authenticated) 사용자의 직접 호출 차단.
REVOKE ALL ON FUNCTION send_permission_audit_summary() FROM PUBLIC;

-- =========================================================================
-- 4. pg_cron 스케줄
--    - 만료 처리: 매일 자정 UTC ('0 0 * * *')
--    - 감사 요약: 분기 첫날 자정 UTC ('0 0 1 */3 *')
--    로컬 등 pg_cron 미탑재 환경에서도 마이그레이션이 실패하지 않도록 DO 블록으로 감싸고,
--    실패 시 함수/enum 은 그대로 두고 스케줄만 건너뛴다. 재실행 대비 unschedule 후 재등록.
-- =========================================================================
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'permission-expiry-daily') THEN
    PERFORM cron.unschedule('permission-expiry-daily');
  END IF;
  PERFORM cron.schedule('permission-expiry-daily', '0 0 * * *',
                        'SELECT process_permission_expiry();');

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'permission-audit-summary-quarterly') THEN
    PERFORM cron.unschedule('permission-audit-summary-quarterly');
  END IF;
  PERFORM cron.schedule('permission-audit-summary-quarterly', '0 0 1 */3 *',
                        'SELECT send_permission_audit_summary();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron 스케줄 등록 건너뜀(pg_cron 미탑재 환경 추정): %', SQLERRM;
END
$cron$;
