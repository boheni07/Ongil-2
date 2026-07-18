-- =============================================================================
-- 08_guardians.sql — §4-9 guardians RLS (allow-all 폐쇄 핫픽스 회귀 방지)
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-8]_*.sql
-- 검증: guardians_select(본인 링크만) / guardians_insert(본인·주보호자·자기 person 한정) / UPDATE·DELETE 부재
--   (20260710010000_p1_person_self_and_guardians_rls)
-- ▶ 이 파일은 특히 "임의 인증자가 guardians(user_id=self, person_id=victim, is_primary=true) 를
--    INSERT 해 타인 person 을 장악"하는 이전 취약점이 재발하지 않음을 증명한다.
-- =============================================================================
BEGIN;
SELECT plan(8);

SELECT tests.mk_user('a8000000-0000-0000-0000-00000000000a', 'guardian');  -- GP
SELECT tests.mk_user('a8000000-0000-0000-0000-00000000000b', 'guardian');  -- ATT 공격자
SELECT tests.mk_user('a8000000-0000-0000-0000-00000000000e', 'guardian');  -- LEG VIC 의 정당한 주보호자
SELECT tests.mk_person('a8000000-0000-0000-0000-00000000000c','a8000000-0000-0000-0000-00000000000a', DATE '2013-01-01'); -- PG(주보호자 GP), 링크 시드
SELECT tests.mk_guardian_link('a8000000-0000-0000-0000-00000000000a','a8000000-0000-0000-0000-00000000000c', true);
SELECT tests.mk_person('a8000000-0000-0000-0000-00000000000f','a8000000-0000-0000-0000-00000000000a', DATE '2013-01-01'); -- PN(주보호자 GP), 링크 없음
SELECT tests.mk_person('a8000000-0000-0000-0000-00000000001a','a8000000-0000-0000-0000-00000000000a', DATE '2013-01-01'); -- PN2
SELECT tests.mk_person('a8000000-0000-0000-0000-00000000000d','a8000000-0000-0000-0000-00000000000e', DATE '2013-01-01'); -- VIC(주보호자 LEG)

-- ── SELECT: 본인 링크만 ─────────────────────────────────────────────────────
SELECT tests.login('a8000000-0000-0000-0000-00000000000a');  -- GP
SELECT is((SELECT count(*) FROM guardians WHERE user_id='a8000000-0000-0000-0000-00000000000a'),
          1::bigint, '보호자는 자신이 걸린 guardians 링크 SELECT 가능');

RESET ROLE; SELECT tests.login('a8000000-0000-0000-0000-00000000000b');  -- ATT
SELECT is((SELECT count(*) FROM guardians WHERE user_id='a8000000-0000-0000-0000-00000000000a'),
          0::bigint, '타인의 guardians 링크는 볼 수 없음(allow-all 폐쇄 확인)');

-- ── INSERT: 본인·is_primary·자기 person 3조건 ───────────────────────────────
RESET ROLE; SELECT tests.login('a8000000-0000-0000-0000-00000000000a');  -- GP
SELECT lives_ok(
  $$ INSERT INTO guardians(user_id, person_id, is_primary)
     VALUES ('a8000000-0000-0000-0000-00000000000a','a8000000-0000-0000-0000-00000000000f', true) $$,
  '주보호자가 자기 명의(is_primary=true, 자기 person)로 guardians INSERT 가능(Flow-G-01)');

SELECT throws_ok(
  $$ INSERT INTO guardians(user_id, person_id, is_primary)
     VALUES ('a8000000-0000-0000-0000-00000000000a','a8000000-0000-0000-0000-00000000001a', false) $$,
  '42501', NULL, 'is_primary=false 링크 INSERT 차단(공동보호자는 초대/service_role 경로)');

-- 핵심 취약점 회귀 방지: 공격자가 타인 person(VIC, 주보호자 LEG)에 자기 링크 주입 시도
RESET ROLE; SELECT tests.login('a8000000-0000-0000-0000-00000000000b');  -- ATT
SELECT throws_ok(
  $$ INSERT INTO guardians(user_id, person_id, is_primary)
     VALUES ('a8000000-0000-0000-0000-00000000000b','a8000000-0000-0000-0000-00000000000d', true) $$,
  '42501', NULL, '공격자는 타인 person(primary_guardian_id≠self)에 guardians 링크를 주입할 수 없음(장악 차단)');

-- 타인 명의(user_id≠self) INSERT 차단
SELECT throws_ok(
  $$ INSERT INTO guardians(user_id, person_id, is_primary)
     VALUES ('a8000000-0000-0000-0000-00000000000a','a8000000-0000-0000-0000-00000000001a', true) $$,
  '42501', NULL, 'user_id 를 타인으로 한 guardians INSERT 차단');

-- ── UPDATE/DELETE 정책 부재 → 변경 불가 ─────────────────────────────────────
RESET ROLE; SELECT tests.login('a8000000-0000-0000-0000-00000000000a');  -- GP
WITH u AS (UPDATE guardians SET is_primary=false
                      WHERE user_id='a8000000-0000-0000-0000-00000000000a' AND person_id='a8000000-0000-0000-0000-00000000000c'
                      RETURNING 1)
SELECT is((SELECT count(*) FROM u),
          0::bigint, 'guardians UPDATE 정책 부재 → 변경 불가(관계 변경은 service_role)');
WITH d AS (DELETE FROM guardians
                      WHERE user_id='a8000000-0000-0000-0000-00000000000a' AND person_id='a8000000-0000-0000-0000-00000000000c'
                      RETURNING 1)
SELECT is((SELECT count(*) FROM d),
          0::bigint, 'guardians DELETE 정책 부재 → 해제 불가(관계 해제는 service_role)');

SELECT * FROM finish();
ROLLBACK;
