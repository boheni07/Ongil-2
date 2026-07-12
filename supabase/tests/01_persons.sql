-- =============================================================================
-- 01_persons.sql — §4-1 persons RLS
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-8]_*.sql
-- 검증 정책: persons_select / persons_insert (최종본: 20260710010000_p1_person_self_and_guardians_rls)
-- =============================================================================
BEGIN;
SELECT plan(9);

-- 식별자(전부 유효 hex): G1 주보호자 / G2 무관보호자 / T 권한없는전문가 / P1 미성년당사자 / SP 성년셀프당사자
-- G1 = 11.. G2 = 22.. T = 33.. P1 = aaaa..a1 SP = bbbb..b1 S2 = bbbb..b2
SELECT tests.mk_user('11111111-1111-1111-1111-111111111111', 'guardian');
SELECT tests.mk_user('22222222-2222-2222-2222-222222222222', 'guardian');
SELECT tests.mk_user('33333333-3333-3333-3333-333333333333', 'therapist');
SELECT tests.mk_person('aaaaaaaa-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', DATE '2015-01-01');
SELECT tests.mk_guardian_link('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);

-- 셀프 가입 성년 당사자 SP (users.id = persons.id = 본인, 자기 자신이 주보호자)
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-0000000000b1', 'person');
SELECT tests.mk_person('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000b1', DATE '2000-01-01');

-- ── SELECT ──────────────────────────────────────────────────────────────────
SELECT tests.login('11111111-1111-1111-1111-111111111111');   -- G1 주보호자
SELECT is((SELECT count(*) FROM persons WHERE id = 'aaaaaaaa-0000-0000-0000-0000000000a1'),
          1::bigint, 'G1 주보호자는 자기 당사자 P1 을 SELECT 가능(primary_guardian_id 분기)');

RESET ROLE; SELECT tests.login('bbbbbbbb-0000-0000-0000-0000000000b1');   -- 성년 당사자 본인
SELECT is((SELECT count(*) FROM persons WHERE id = 'bbbbbbbb-0000-0000-0000-0000000000b1'),
          1::bigint, '당사자 본인은 자기 persons 행을 SELECT 가능(role=person AND id=auth.uid())');

RESET ROLE; SELECT tests.login('22222222-2222-2222-2222-222222222222');   -- 무관한 보호자 G2
SELECT is((SELECT count(*) FROM persons WHERE id = 'aaaaaaaa-0000-0000-0000-0000000000a1'),
          0::bigint, '무관한 보호자 G2 는 타인 당사자 P1 을 볼 수 없음');

RESET ROLE; SELECT tests.login('33333333-3333-3333-3333-333333333333');   -- 권한 없는 전문가 T
SELECT is((SELECT count(*) FROM persons WHERE id = 'aaaaaaaa-0000-0000-0000-0000000000a1'),
          0::bigint, '권한 없는 전문가는 타인 당사자를 볼 수 없음');

-- ── INSERT ──────────────────────────────────────────────────────────────────
RESET ROLE; SELECT tests.login('11111111-1111-1111-1111-111111111111');   -- guardian
SELECT lives_ok(
  $$ INSERT INTO persons(primary_guardian_id, full_name, birth_date, updated_at)
     VALUES ('11111111-1111-1111-1111-111111111111','신규아동', DATE '2016-05-05', now()) $$,
  '보호자는 당사자를 INSERT 가능(persons_insert role=guardian 분기)');

RESET ROLE; SELECT tests.login('33333333-3333-3333-3333-333333333333');   -- therapist
SELECT throws_ok(
  $$ INSERT INTO persons(primary_guardian_id, full_name, birth_date, updated_at)
     VALUES ('33333333-3333-3333-3333-333333333333','불법아동', DATE '2016-05-05', now()) $$,
  '42501', NULL,
  '비보호자(therapist)는 persons INSERT 가 RLS 로 차단됨');

-- 셀프 가입 person 은 자기 자신만 등록 가능(id=auth.uid AND primary_guardian_id=auth.uid)
RESET ROLE;
SELECT tests.mk_user('bbbbbbbb-0000-0000-0000-0000000000b2', 'person');
SELECT tests.login('bbbbbbbb-0000-0000-0000-0000000000b2');
SELECT lives_ok(
  $$ INSERT INTO persons(id, primary_guardian_id, full_name, birth_date, updated_at)
     VALUES ('bbbbbbbb-0000-0000-0000-0000000000b2','bbbbbbbb-0000-0000-0000-0000000000b2','셀프',DATE '1999-01-01', now()) $$,
  'person 역할은 자기 자신을 셀프 등록 가능(id=auth.uid, 자기가 주보호자)');

-- person 이 "다른 사람"을 자기 명의로 등록 시도 → 차단(id≠auth.uid)
SELECT throws_ok(
  $$ INSERT INTO persons(id, primary_guardian_id, full_name, birth_date, updated_at)
     VALUES (gen_random_uuid(),'bbbbbbbb-0000-0000-0000-0000000000b2','타인',DATE '2010-01-01', now()) $$,
  '42501', NULL,
  'person 역할은 타인(id≠auth.uid) 을 persons INSERT 할 수 없음');

-- person 이 주보호자를 타인으로 지정 시도 → 차단(primary_guardian_id≠auth.uid)
SELECT throws_ok(
  $$ INSERT INTO persons(id, primary_guardian_id, full_name, birth_date, updated_at)
     VALUES ('bbbbbbbb-0000-0000-0000-0000000000b2','11111111-1111-1111-1111-111111111111','자기지만타인보호자',DATE '1999-01-01', now()) $$,
  '42501', NULL,
  'person 셀프 등록은 primary_guardian_id 를 타인으로 지정할 수 없음');

SELECT * FROM finish();
ROLLBACK;
