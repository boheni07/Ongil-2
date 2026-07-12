-- =============================================================================
-- 03_permissions.sql — §4-3 permissions RLS
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-8]_*.sql
-- 검증 정책: permissions_write(FOR ALL, 주보호자만) / permissions_select(grantee 또는 임의 보호자)
--   (20260709040253_p0_4_rls_policies)
-- ▶ 핵심: 권한 부여/수정/회수는 "주보호자(is_primary=true)" 만. 공동보호자·grantee 는 불가.
-- =============================================================================
BEGIN;
SELECT plan(11);

-- GP 주보호자 / G2 공동보호자(비주) / PG 당사자 / GR grantee / OUT 외부인
SELECT tests.mk_user('a3000000-0000-0000-0000-00000000000a', 'guardian');   -- GP primary
SELECT tests.mk_user('a3000000-0000-0000-0000-00000000000b', 'guardian');   -- G2 non-primary
SELECT tests.mk_person('a3000000-0000-0000-0000-00000000000c','a3000000-0000-0000-0000-00000000000a', DATE '2013-01-01');
SELECT tests.mk_guardian_link('a3000000-0000-0000-0000-00000000000a','a3000000-0000-0000-0000-00000000000c', true);
SELECT tests.mk_guardian_link('a3000000-0000-0000-0000-00000000000b','a3000000-0000-0000-0000-00000000000c', false);
SELECT tests.mk_user('a3000000-0000-0000-0000-000000000001', 'supporter');  -- GR grantee
SELECT tests.mk_user('a3000000-0000-0000-0000-000000000002', 'supporter');  -- OUT
-- 시드 권한(PG, GR, MED, read)
SELECT tests.mk_perm('a3000000-0000-0000-0000-00000000000c','a3000000-0000-0000-0000-000000000001','MED','read');

-- ── INSERT: 주보호자만 ──────────────────────────────────────────────────────
SELECT tests.login('a3000000-0000-0000-0000-00000000000a');  -- GP primary
SELECT lives_ok(
  $$ INSERT INTO permissions(person_id,grantee_id,domain,access_level,updated_at)
     VALUES ('a3000000-0000-0000-0000-00000000000c','a3000000-0000-0000-0000-000000000001','EDU','write',now()) $$,
  '주보호자는 permissions INSERT 가능');

RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-00000000000b');  -- G2 non-primary
SELECT throws_ok(
  $$ INSERT INTO permissions(person_id,grantee_id,domain,access_level,updated_at)
     VALUES ('a3000000-0000-0000-0000-00000000000c','a3000000-0000-0000-0000-000000000001','WEL','read',now()) $$,
  '42501', NULL, '공동보호자(비주)는 permissions INSERT 불가');

-- grantee 가 스스로 권한을 부여(상승) 시도 → 차단
RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-000000000001');  -- GR
SELECT throws_ok(
  $$ INSERT INTO permissions(person_id,grantee_id,domain,access_level,updated_at)
     VALUES ('a3000000-0000-0000-0000-00000000000c','a3000000-0000-0000-0000-000000000001','LEG','edit',now()) $$,
  '42501', NULL, 'grantee 는 자기 자신에게 권한을 부여할 수 없음(권한 상승 차단)');

-- ── SELECT ──────────────────────────────────────────────────────────────────
SELECT is((SELECT count(*) FROM permissions
           WHERE person_id='a3000000-0000-0000-0000-00000000000c' AND grantee_id='a3000000-0000-0000-0000-000000000001' AND domain='MED'),
          1::bigint, 'grantee 는 자기에게 부여된 권한 행 SELECT 가능');

RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-00000000000a');  -- GP
SELECT is((SELECT count(*) FROM permissions
           WHERE person_id='a3000000-0000-0000-0000-00000000000c' AND grantee_id='a3000000-0000-0000-0000-000000000001' AND domain='MED'),
          1::bigint, '주보호자는 당사자 권한 행 SELECT 가능');

RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-00000000000b');  -- G2 (임의 보호자)
SELECT is((SELECT count(*) FROM permissions
           WHERE person_id='a3000000-0000-0000-0000-00000000000c' AND grantee_id='a3000000-0000-0000-0000-000000000001' AND domain='MED'),
          1::bigint, '공동보호자도 권한 행 SELECT 는 가능(permissions_select 는 임의 보호자 허용)');

RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-000000000002');  -- OUT
SELECT is((SELECT count(*) FROM permissions
           WHERE person_id='a3000000-0000-0000-0000-00000000000c'),
          0::bigint, '외부인은 권한 행을 볼 수 없음');

-- ── UPDATE(회수: is_active=false) ───────────────────────────────────────────
RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-00000000000b');  -- G2 non-primary
SELECT is((WITH u AS (UPDATE permissions SET is_active=false, updated_at=now()
                      WHERE person_id='a3000000-0000-0000-0000-00000000000c' AND grantee_id='a3000000-0000-0000-0000-000000000001' AND domain='MED'
                      RETURNING 1) SELECT count(*) FROM u),
          0::bigint, '공동보호자는 permissions UPDATE 불가(0행)');

RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-00000000000a');  -- GP primary
SELECT is((WITH u AS (UPDATE permissions SET is_active=false, updated_at=now()
                      WHERE person_id='a3000000-0000-0000-0000-00000000000c' AND grantee_id='a3000000-0000-0000-0000-000000000001' AND domain='MED'
                      RETURNING 1) SELECT count(*) FROM u),
          1::bigint, '주보호자는 permissions UPDATE(회수) 가능(1행)');

-- ── DELETE ──────────────────────────────────────────────────────────────────
RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-00000000000b');  -- G2 non-primary
SELECT is((WITH d AS (DELETE FROM permissions
                      WHERE person_id='a3000000-0000-0000-0000-00000000000c' AND grantee_id='a3000000-0000-0000-0000-000000000001' AND domain='MED'
                      RETURNING 1) SELECT count(*) FROM d),
          0::bigint, '공동보호자는 permissions DELETE 불가(0행)');

RESET ROLE; SELECT tests.login('a3000000-0000-0000-0000-00000000000a');  -- GP primary
SELECT is((WITH d AS (DELETE FROM permissions
                      WHERE person_id='a3000000-0000-0000-0000-00000000000c' AND grantee_id='a3000000-0000-0000-0000-000000000001' AND domain='MED'
                      RETURNING 1) SELECT count(*) FROM d),
          1::bigint, '주보호자는 permissions DELETE 가능(1행)');

SELECT * FROM finish();
ROLLBACK;
