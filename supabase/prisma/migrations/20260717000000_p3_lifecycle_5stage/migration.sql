-- P3: 생애주기 3단계 → 5단계 확장 (2026-07-17 채택)
-- 참조: docs/07-lifecycle-record-permission-proposal.md v0.2, docs/05-erd.md §2-2-1/§4-6
-- 작성: backend-db
--
-- 요지: life_stage는 birth_date 파생값(저장 안 함)이라 이 마이그레이션은 함수 로직만 바꾼다.
--   - infant(0~5) / child(6~12) / youth(13~18) / adult(19~64) / senior(65+) 5단계로 확장.
--   - 성년 경계 18→19세로 상향(민법상 성년 기준 정합). persons.is_adult 물질화 컬럼의
--     의미("동의 주체가 본인으로 이관됐는가")는 유지하되 문턱값만 바뀐다.
--   - 청소년기 알림 트리거 연령 14→13세로 이동(youth 시작 연령과 일치).
--   - 노년기(65세) 진입 알림을 청소년기 알림과 동일 패턴(NOT EXISTS 가드, 평생 1회)으로 신설.

-- =========================================================================
-- 1. NotificationType enum — 노년기 진입 알림 값 추가
-- =========================================================================
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'life_stage_senior';

-- =========================================================================
-- 2. get_life_stage() 5단계로 재정의 (persons_with_stage 뷰는 그대로 이 함수를 참조)
-- =========================================================================
CREATE OR REPLACE FUNCTION get_life_stage(p_birth_date date)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN date_part('year', age(p_birth_date)) >= 65 THEN 'senior'  -- 노년기
    WHEN date_part('year', age(p_birth_date)) >= 19 THEN 'adult'   -- 성인기 (기존 18→19)
    WHEN date_part('year', age(p_birth_date)) >= 13 THEN 'youth'   -- 청소년 전환기 (기존과 동일)
    WHEN date_part('year', age(p_birth_date)) >= 6  THEN 'child'   -- 아동기 (기존 13이하 → 6~12로 축소)
    ELSE 'infant'                                                    -- 영유아기 (신규)
  END;
$$;

-- =========================================================================
-- 3. assign_record_confirmer() — 확인주체가 "본인"인 조건을 adult 단독 → adult/senior 로 확장
-- =========================================================================
CREATE OR REPLACE FUNCTION assign_record_confirmer()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_stage text; v_guardian uuid;
BEGIN
  IF NEW.requires_confirmation = true AND NEW.is_draft = false
     AND (OLD IS NULL OR OLD.is_draft = true) THEN
    SELECT get_life_stage(birth_date) INTO v_stage FROM persons WHERE id = NEW.person_id;
    IF v_stage IN ('adult', 'senior') THEN
      NEW.confirmer_id := NEW.person_id;   -- 본인 확인 (persons.id = 당사자 auth.uid())
    ELSE
      SELECT primary_guardian_id INTO v_guardian FROM persons WHERE id = NEW.person_id;
      NEW.confirmer_id := v_guardian;
    END IF;
    NEW.confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================================
-- 4. process_life_stage_transitions() — 성년 전환 18→19세, 청소년 진입 14→13세,
--    노년기 진입(65세) 알림 신설
-- =========================================================================
CREATE OR REPLACE FUNCTION process_life_stage_transitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- ── 성인기 전환(만 19세, 기존 18세에서 상향) ────────────────────────────
  WITH promoted AS (
    UPDATE persons
       SET is_adult = true,
           updated_at = now()
     WHERE is_adult = false
       AND birth_date <= (CURRENT_DATE - INTERVAL '19 years')::date
    RETURNING id, full_name, primary_guardian_id
  )
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT primary_guardian_id,
         'life_stage_adult',
         '성인기 전환 안내',
         full_name || '님이 성인(만 19세)이 되어 동의 주체 이관 절차가 시작됩니다.',
         jsonb_build_object('person_id', id)
    FROM promoted;

  -- ── 청소년 전환기 진입(만 13세, 기존 14세에서 하향) — 보호자 알림 ─────────
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT p.primary_guardian_id,
         'life_stage_youth',
         '청소년 전환기 진입 안내',
         p.full_name || '님이 만 13세가 되어 전환계획 수립이 필요합니다.',
         jsonb_build_object('person_id', p.id)
    FROM persons p
   WHERE date_part('year', age(p.birth_date)) = 13
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.recipient_id = p.primary_guardian_id
          AND n.type = 'life_stage_youth'
          AND n.data->>'person_id' = p.id::text
     );

  -- ── 청소년 전환기 진입(만 13세) — 담당 특수교사 알림 ──────────────────────
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT perm.grantee_id,
         'life_stage_youth',
         '담당 당사자 전환기 진입 안내',
         per.full_name || '님이 만 13세가 되어 전환계획이 활성화됩니다.',
         jsonb_build_object('person_id', per.id)
    FROM persons per
    JOIN permissions perm ON perm.person_id = per.id
    JOIN users u          ON u.id = perm.grantee_id
   WHERE date_part('year', age(per.birth_date)) = 13
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

  -- ── 노년기 진입(만 65세, 신규) — 주보호자/본인 알림 ───────────────────────
  --   동의 주체 변화는 없다(이미 성인기부터 본인). 돌봄·후견 관련 지원 강조 목적의
  --   정보성 알림이라 물질화 컬럼 없이 청소년 알림과 동일한 NOT EXISTS 가드로 평생 1회만 발화.
  INSERT INTO notifications (recipient_id, type, title, body, data)
  SELECT p.primary_guardian_id,
         'life_stage_senior',
         '노년기 진입 안내',
         p.full_name || '님이 만 65세가 되어 돌봄·후견 관련 지원이 중요해지는 시기입니다.',
         jsonb_build_object('person_id', p.id)
    FROM persons p
   WHERE date_part('year', age(p.birth_date)) = 65
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.recipient_id = p.primary_guardian_id
          AND n.type = 'life_stage_senior'
          AND n.data->>'person_id' = p.id::text
     );
END;
$fn$;

REVOKE ALL ON FUNCTION process_life_stage_transitions() FROM PUBLIC;
