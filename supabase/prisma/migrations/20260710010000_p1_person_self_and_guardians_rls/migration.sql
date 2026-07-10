-- P1: 당사자(person) 자가등록·자기기록 RLS 분기 추가 + guardians allow-all 노출 폐쇄
-- 참조: docs/05-erd.md §4-1(persons) / §4-2(records) / §4-9(guardians 신설)
-- 관련 기능: P1-3(당사자 자기표현 SELF-*), P1-4(활동지원 일지 DAI-*), P1-5(보호자 대시보드 + Flow-G-01 당사자 등록)
--
-- 발견 갭:
--   (1) persons_insert 가 role='guardian' 만 허용 → person 역할 셀프 가입 당사자가
--       자기 persons 행을 만들 경로가 없어 persons_select 의 person 분기가 죽어 있었다.
--   (2) records_insert / records_update 에 person 분기가 없어 당사자 본인이 자기표현(SELF-*)
--       기록을 작성·수정할 수 없었다(records_select 에는 person 분기가 있어 비대칭).
--   (3) guardians 는 P0-4 grants 에서 authenticated 에 CRUD GRANT 만 받고
--       ENABLE ROW LEVEL SECURITY 가 어디에도 없었다 → consents(§4-7)와 동일한 allow-all 노출.
--       임의 인증 사용자가 guardians(user_id=self, person_id=victim, is_primary=true) 를 INSERT 하면
--       records_*/permissions_write/persons_select 의 guardians 분기를 통해 타인 person 전체를 장악 가능.

-- =========================================================================
-- §4-1. persons — person 역할 자기 자신 등록 분기 추가
-- =========================================================================

DROP POLICY IF EXISTS persons_insert ON persons;

-- 보호자(대리 등록) 또는 person 역할의 셀프 가입(자기 자신 등록)만 INSERT
CREATE POLICY persons_insert ON persons FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'guardian'
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'person'
      AND id = auth.uid()                    -- persons.id = 당사자 auth.uid()
      AND primary_guardian_id = auth.uid()   -- 자기 자신이 주보호자
    )
  );

-- =========================================================================
-- §4-2. records — person 역할 자기 기록 작성/수정 분기 추가
-- =========================================================================

DROP POLICY IF EXISTS records_insert ON records;

-- 도메인 write/edit 권한 보유자, 보호자, 또는 당사자 본인(자기 기록)만 INSERT
CREATE POLICY records_insert ON records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level IN ('write','edit')
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
    -- 당사자 본인: 자기 person(=auth.uid())에 대한, 자기가 작성자인 기록만
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'person'
      AND person_id = auth.uid()
      AND author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS records_update ON records;

-- edit 권한 보유자, 보호자, 또는 당사자 본인이 '자기가 작성한' 기록만 UPDATE
-- (author_id 로 한정 → 전문가가 당사자에게 작성한 공식 기록(requires_confirmation=true)은
--  당사자가 임의 수정 불가. 자기표현(SELF-*)은 본인이 작성자이므로 오타 수정 등 가능.)
CREATE POLICY records_update ON records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level = 'edit'
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'person'
      AND person_id = auth.uid()
      AND author_id = auth.uid()
    )
  );

-- =========================================================================
-- §4-9. guardians — allow-all 노출 폐쇄 (핫픽스)
-- =========================================================================
-- 주의: 아래 EXISTS 서브쿼리들이 있는 상위 정책(records_*, permissions_write,
--       persons_select, access_logs_select)은 모두 guardians 를 user_id = auth.uid()
--       로 필터하므로, guardians_select(user_id = auth.uid())로도 정상 평가된다.
--       (guardians 자기참조 서브쿼리는 RLS 무한재귀를 유발하므로 정책에서 배제)

ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

-- 보호자 본인은 자신이 걸린 guardians 링크만 조회
CREATE POLICY guardians_select ON guardians FOR SELECT
  USING (user_id = auth.uid());

-- 주보호자 본인만 '자기 명의로' INSERT (Flow-G-01 당사자 등록):
--   본인(user_id=auth.uid())이 is_primary=true 로, 그리고 그 person 의
--   primary_guardian_id 가 이미 자기 자신으로 등록된 경우에 한함.
-- 공동보호자 초대 수락으로 인한 guardians INSERT 는 invitations(P0-7) 기반으로
--   service_role/Edge Function 에서 처리한다(클라이언트 authenticated INSERT 아님).
CREATE POLICY guardians_insert ON guardians FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_primary = true
    AND EXISTS (
      SELECT 1 FROM persons
      WHERE id = guardians.person_id
        AND primary_guardian_id = auth.uid()
    )
  );

-- UPDATE/DELETE 정책 없음 → authenticated 에 대해 기본 거부.
-- 보호자 관계 변경/해제는 service_role(감사 로그 동반)에서만 수행한다.
