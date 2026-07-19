-- P3: 사용자 본인 프로필(이름·프로필 사진) 수정 허용
-- 참조: docs/05-erd.md §2-1 users, 2026-07-14 p2_privacy_settings(users_deactivate_own 정책)
--
-- users_deactivate_own(FOR UPDATE, USING/WITH CHECK id=auth.uid())은 이미 "본인 행만" 이라는
-- 행 단위 제약을 걸어뒀다 — 이번엔 새 정책을 만들 필요 없이, 그 정책 밑에서 갱신 가능한
-- 컬럼 집합만 넓힌다(2026-07-18 p3_users_column_grant_hotfix 사고 재발 방지: 반드시 기존
-- GRANT에 컬럼을 "추가"하는 형태로만 실행한다 — REVOKE 없이 그대로 둔 채 GRANT를 덧붙이면
-- 컬럼 권한은 가산적이라 안전하게 합쳐진다. full_name/email/role 등 나머지 컬럼은 여전히
-- UPDATE 불가).
GRANT UPDATE (full_name, avatar_url) ON public.users TO authenticated;
