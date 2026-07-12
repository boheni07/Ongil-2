-- =============================================================================
-- 06_consents.sql — §4-7 consents RLS + 컬럼 레벨 불변성 (PIPA §22/§23)
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-8]_*.sql
-- 검증: consents_select/insert/update(본인 한정) + DELETE 차단 + revoked_at 만 UPDATE 허용
--   (20260710000000_p0_7_consents_invitations_rls)
-- =============================================================================
BEGIN;
SELECT plan(7);

SELECT tests.mk_user('a6000000-0000-0000-0000-000000000001', 'person');  -- U1
SELECT tests.mk_user('a6000000-0000-0000-0000-000000000002', 'person');  -- U2
-- U1 의 동의 1건 시드
INSERT INTO consents(user_id, consent_type, is_agreed, version, agreed_at)
  VALUES ('a6000000-0000-0000-0000-000000000001','terms', true, '1.0', now());

-- ── INSERT: 본인 명의만 ─────────────────────────────────────────────────────
SELECT tests.login('a6000000-0000-0000-0000-000000000001');  -- U1
SELECT lives_ok(
  $$ INSERT INTO consents(user_id, consent_type, is_agreed, version, agreed_at)
     VALUES ('a6000000-0000-0000-0000-000000000001','privacy', true, '1.0', now()) $$,
  '본인 명의 consent INSERT 가능');
SELECT throws_ok(
  $$ INSERT INTO consents(user_id, consent_type, is_agreed, version, agreed_at)
     VALUES ('a6000000-0000-0000-0000-000000000002','marketing', true, '1.0', now()) $$,
  '42501', NULL, '타인(user_id≠self) 명의 consent INSERT 차단');

-- ── SELECT: 본인만 ──────────────────────────────────────────────────────────
SELECT is((SELECT count(*) FROM consents WHERE user_id='a6000000-0000-0000-0000-000000000001' AND consent_type='terms'),
          1::bigint, '본인 동의 SELECT 가능');

RESET ROLE; SELECT tests.login('a6000000-0000-0000-0000-000000000002');  -- U2
SELECT is((SELECT count(*) FROM consents WHERE user_id='a6000000-0000-0000-0000-000000000001'),
          0::bigint, '타인의 동의는 볼 수 없음(PIPA 기밀)');

-- ── UPDATE: revoked_at 컬럼만 ───────────────────────────────────────────────
RESET ROLE; SELECT tests.login('a6000000-0000-0000-0000-000000000001');  -- U1
SELECT lives_ok(
  $$ UPDATE consents SET revoked_at = now() WHERE user_id='a6000000-0000-0000-0000-000000000001' AND consent_type='terms' $$,
  '본인은 revoked_at(철회) UPDATE 가능');
SELECT throws_ok(
  $$ UPDATE consents SET is_agreed = false WHERE user_id='a6000000-0000-0000-0000-000000000001' AND consent_type='terms' $$,
  '42501', NULL, 'revoked_at 외 컬럼(is_agreed) UPDATE 는 컬럼 권한으로 차단(동의내용 변조 불가)');

-- ── DELETE: 전면 차단(불변) ─────────────────────────────────────────────────
SELECT throws_ok(
  $$ DELETE FROM consents WHERE user_id='a6000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'consents DELETE 는 REVOKE 로 차단(불변 감사)');

SELECT * FROM finish();
ROLLBACK;
