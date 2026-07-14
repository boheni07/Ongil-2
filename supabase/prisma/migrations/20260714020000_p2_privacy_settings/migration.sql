-- P2 개인정보 설정(동의·권리 관리, G-65 보호자 / P-23 당사자, 라우트 /settings/privacy)
-- 참조: docs/01-prd.md §3-4(권리행사), docs/05-erd.md §2-1 users / §4-7 consents
-- 작성: backend-db
--
-- 스코프(사용자 확정): "회원탈퇴"는 계정 완전 삭제가 아니라
--   "동의 전체철회 + 계정 비활성화"다. persons.primary_guardian_id 가 ON DELETE RESTRICT,
--   records.person_id 가 ON DELETE CASCADE 라서 users/persons 행을 실제로 삭제하면
--   다른 이해관계자가 작성한 당사자 전체 기록까지 연쇄 삭제되는 위험이 있어 이를 피한다.
--   → 비활성화는 users.deactivated_at 타임스탬프로만 표현한다(행 삭제 없음).
--
-- 컬럼 레벨 제한 사상은 consents.revoked_at(§4-7)과 동일하다:
--   public.users 는 P0-5(20260709042335)에서 RLS ENABLED + SELECT(본인) 정책만 갖고
--   UPDATE 정책이 전혀 없어 모든 UPDATE 가 전면 차단된 상태다(role 등 민감 컬럼 보호).
--   이번엔 그 설계를 유지한 채 deactivated_at 단일 컬럼만 본인이 갱신하도록 연다.

ALTER TABLE public.users ADD COLUMN deactivated_at timestamptz;

-- 본인 행 UPDATE 만 허용(다른 사용자 비활성화 차단). USING/WITH CHECK 둘 다 본인 한정.
CREATE POLICY users_deactivate_own ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 정책만으로는 "어느 컬럼을 바꿨나"를 제어할 수 없다. deactivated_at 하나만 UPDATE 가능하도록
-- 컬럼 레벨 권한으로 못박는다 — full_name/email/role/fcm_token 등은 여전히 UPDATE 불가.
GRANT UPDATE (deactivated_at) ON public.users TO authenticated;
