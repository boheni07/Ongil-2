-- =============================================================================
-- 12_privacy_consents.sql — G-65/P-23 동의·권리 관리 RLS
--   (20260714020000_p2_privacy_settings + 20260710000000_p0_7_consents_invitations_rls)
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/12_*.sql
-- 검증:
--   · users.deactivated_at 는 본인만 UPDATE 가능(타인 행은 RLS 로 0행)
--   · deactivated_at 외 컬럼(full_name 등)은 컬럼 권한으로 UPDATE 차단
--   · consents 는 타인 행 revoked_at UPDATE 불가(RLS 0행), 본인 선택동의 철회 가능
-- ※ "선택 동의만 철회 가능"은 애플리케이션 레벨(withdrawOptionalConsent) 체크이며
--    DB 레벨 강제가 아니다 — 여기서는 RLS/컬럼권한 경계만 검증한다.
-- =============================================================================
BEGIN;
SELECT plan(6);

SELECT tests.mk_user('c2000000-0000-0000-0000-000000000001', 'person');    -- U1
SELECT tests.mk_user('c2000000-0000-0000-0000-000000000002', 'guardian');  -- U2

-- U1 의 선택 동의 1건 시드(postgres 역할 = RLS 우회)
INSERT INTO consents(user_id, consent_type, is_agreed, version, agreed_at)
  VALUES ('c2000000-0000-0000-0000-000000000001','marketing', true, 'v1.0', now());

-- ── users.deactivated_at: 본인만 ────────────────────────────────────────────
SELECT tests.login('c2000000-0000-0000-0000-000000000001');  -- U1
SELECT lives_ok(
  $$ UPDATE users SET deactivated_at = now() WHERE id = 'c2000000-0000-0000-0000-000000000001' $$,
  '본인 users.deactivated_at UPDATE 가능(계정 비활성화)');

SELECT isnt(
  (SELECT deactivated_at FROM users WHERE id = 'c2000000-0000-0000-0000-000000000001'),
  NULL,
  '본인 비활성화 시각이 실제로 기록됨');

-- deactivated_at 외 컬럼은 컬럼 권한으로 차단(민감 컬럼 변조 불가)
SELECT throws_ok(
  $$ UPDATE users SET full_name = '변조' WHERE id = 'c2000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'deactivated_at 외 컬럼(full_name) UPDATE 는 컬럼 권한으로 차단');

-- ── 타인 users 행 비활성화 차단(RLS → 0행) ──────────────────────────────────
RESET ROLE; SELECT tests.login('c2000000-0000-0000-0000-000000000002');  -- U2
WITH u AS (
     UPDATE users SET deactivated_at = now()
     WHERE id = 'c2000000-0000-0000-0000-000000000001' RETURNING 1)
SELECT is(
  (SELECT count(*) FROM u),
  0::bigint,
  '타인 users 행 deactivated_at UPDATE 불가(RLS 로 0행)');

-- ── 타인 consents 철회 차단(RLS → 0행) ──────────────────────────────────────
WITH c AS (
     UPDATE consents SET revoked_at = now()
     WHERE user_id = 'c2000000-0000-0000-0000-000000000001' RETURNING 1)
SELECT is(
  (SELECT count(*) FROM c),
  0::bigint,
  '타인 consents revoked_at UPDATE 불가(RLS 로 0행)');

-- ── 본인 선택동의 철회 가능 ─────────────────────────────────────────────────
RESET ROLE; SELECT tests.login('c2000000-0000-0000-0000-000000000001');  -- U1
SELECT lives_ok(
  $$ UPDATE consents SET revoked_at = now()
     WHERE user_id = 'c2000000-0000-0000-0000-000000000001' AND consent_type = 'marketing' $$,
  '본인 선택동의 revoked_at(철회) UPDATE 가능');

SELECT * FROM finish();
ROLLBACK;
