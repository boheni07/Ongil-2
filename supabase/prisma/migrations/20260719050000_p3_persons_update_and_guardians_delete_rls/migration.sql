-- P3: 당사자 정보 수정 + 피보호자 목록 제외 신설
-- 참조: "보호자 대시보드에서 당사자 정보를 수정할 방법이 없다"는 피드백(2026-07-19)
--
-- 조사 결과 UI만 없던 게 아니라 RLS 자체에도 갭이 있었다: persons 테이블은 p0_4_rls_grants
-- (2026-07-09)에서 이미 테이블 전체 SELECT/INSERT/UPDATE/DELETE를 authenticated에 부여받았지만
-- 실제 정책은 persons_select·persons_insert 둘뿐이었다(라이브 DB pg_policies로 직접 확인) —
-- UPDATE 정책이 하나도 없어 보호자를 포함해 누구도 당사자 정보를 고칠 수 없는 상태였다.
--
-- ⚠️ 여기서 정책만 새로 열고 컬럼 권한을 그대로 뒀다면 2026-07-18 users 컬럼권한 사고와 동일한
-- 계열의 결함이 됐을 것이다 — 테이블 전체 UPDATE GRANT가 이미 존재하는 상태에서 정책만 열면
-- guardians 관계만 있어도 primary_guardian_id(주보호자 위조)·id·is_adult(생애주기 산출값
-- 위조)까지 마음대로 바꿀 수 있다. 그래서 정책 신설과 동시에 반드시 REVOKE 후 안전 컬럼만
-- 재부여한다(순서 중요 — REVOKE 없이 GRANT만 추가하면 컬럼 권한은 가산적이라 no-op).

CREATE POLICY persons_update ON persons FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM guardians WHERE person_id = persons.id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM guardians WHERE person_id = persons.id AND user_id = auth.uid())
  );

REVOKE UPDATE ON public.persons FROM authenticated;
GRANT UPDATE (
  full_name, birth_date, gender, disability_types, disability_degree,
  emergency_info, avatar_url, updated_at
) ON public.persons TO authenticated;

-- 피보호자 목록에서 제외 — 이 보호자 본인의 guardians 링크만 삭제할 수 있다. 주보호자
-- (is_primary=true)는 제외한다: persons.primary_guardian_id가 ON DELETE RESTRICT라
-- 주보호자 링크를 지우면 정합성이 깨진다(주보호자 재지정은 별도 기능, 이번 범위 밖).
-- DELETE는 UPDATE와 달리 컬럼 개념이 없어 행 단위 USING만으로 충분히 안전하다(테이블 전체
-- DELETE GRANT는 p0_4_rls_grants에서 이미 있음, 추가 GRANT 불필요).
CREATE POLICY guardians_delete ON guardians FOR DELETE
  USING (user_id = auth.uid() AND is_primary = false);
