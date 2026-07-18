-- =============================================================================
-- 02_records.sql — §4-2 records RLS (SELECT/INSERT/UPDATE)
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-8]_*.sql
-- 검증 정책: records_select / records_insert / records_update
--   (최종본: 20260710010000_p1_person_self_and_guardians_rls + 20260709040253_p0_4)
--
-- ▶ 필수 커버리지(팀리드 지정):
--   1. 6개 역할 × read/write/edit — records RLS 는 "grantee 의 role" 이 아니라 permissions.access_level
--      로만 판정한다(person 자기표현 분기·guardian 구조 분기 제외). 따라서 전문가 4역할
--      (supporter/teacher/social_worker/therapist)로 read/write/edit 의미를 검증하고,
--      person 은 자기표현 분기, guardian 은 구조 분기로 나머지 2역할을 커버한다.
--   2. 보호자 구조적 전체접근 — permissions 없이 guardians 링크만으로 전 도메인 접근.
--   3. 만료 권한 차단 — valid_until = 어제.
--   ▶ access_level 의미: read=SELECT만 / write=SELECT+INSERT(신규) / edit=SELECT+INSERT+UPDATE(기존수정)
-- =============================================================================
BEGIN;
SELECT plan(22);

-- ── 식별자 ────────────────────────────────────────────────────────────────
-- PS 성년 셀프 당사자 / GP 주보호자 / PG 그가 등록한 당사자
-- SU supporter(read) TE teacher(write) TH therapist(edit) SW social_worker(read)
-- EX 만료 edit / OUT 무권한
SELECT tests.mk_user('a2000000-0000-0000-0000-000000000001', 'person');      -- PS
SELECT tests.mk_person('a2000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001', DATE '2000-01-01');
SELECT tests.mk_user('a2000000-0000-0000-0000-00000000000a', 'guardian');    -- GP
SELECT tests.mk_person('a2000000-0000-0000-0000-00000000000b','a2000000-0000-0000-0000-00000000000a', DATE '2014-01-01'); -- PG
SELECT tests.mk_guardian_link('a2000000-0000-0000-0000-00000000000a','a2000000-0000-0000-0000-00000000000b', true);

SELECT tests.mk_user('a2000000-0000-0000-0000-000000000002', 'supporter');
SELECT tests.mk_user('a2000000-0000-0000-0000-000000000003', 'teacher');
SELECT tests.mk_user('a2000000-0000-0000-0000-000000000004', 'therapist');
SELECT tests.mk_user('a2000000-0000-0000-0000-000000000005', 'social_worker');
SELECT tests.mk_user('a2000000-0000-0000-0000-000000000006', 'therapist');   -- EX
SELECT tests.mk_user('a2000000-0000-0000-0000-000000000007', 'supporter');   -- OUT

-- PG 에 대한 도메인 권한 (UNIQUE(person,grantee,domain))
SELECT tests.mk_perm('a2000000-0000-0000-0000-00000000000b','a2000000-0000-0000-0000-000000000002','MED','read');
SELECT tests.mk_perm('a2000000-0000-0000-0000-00000000000b','a2000000-0000-0000-0000-000000000003','MED','write');
SELECT tests.mk_perm('a2000000-0000-0000-0000-00000000000b','a2000000-0000-0000-0000-000000000004','MED','edit');
SELECT tests.mk_perm('a2000000-0000-0000-0000-00000000000b','a2000000-0000-0000-0000-000000000005','MED','read');
SELECT tests.mk_perm('a2000000-0000-0000-0000-00000000000b','a2000000-0000-0000-0000-000000000006','MED','edit', CURRENT_DATE - 1);  -- 만료

-- 기록: MED(TH 작성), EDU(도메인 격리용), PS 자기표현(DAI, PS 작성)
SELECT tests.mk_record('a2000000-0000-0000-0000-0000000000f1','a2000000-0000-0000-0000-00000000000b','a2000000-0000-0000-0000-000000000004','MED','therapy_note');
SELECT tests.mk_record('a2000000-0000-0000-0000-0000000000f2','a2000000-0000-0000-0000-00000000000b','a2000000-0000-0000-0000-00000000000a','EDU','iep');
SELECT tests.mk_record('a2000000-0000-0000-0000-0000000000f3','a2000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','DAI','self_note');

-- ── read 권한(supporter) ────────────────────────────────────────────────────
SELECT tests.login('a2000000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f1'),
          1::bigint, 'read 권한자(supporter)는 해당 도메인 기록 SELECT 가능');
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,updated_at)
     VALUES ('a2000000-0000-0000-0000-00000000000b','MED','x','{}',now()) $$,
  '42501', NULL, 'read 권한자는 INSERT 불가(RLS)');
WITH u AS (UPDATE records SET content='{"h":1}' WHERE id='a2000000-0000-0000-0000-0000000000f1' RETURNING 1)
SELECT is((SELECT count(*) FROM u), 0::bigint, 'read 권한자는 UPDATE 불가(0행)');

-- ── write 권한(teacher) ─────────────────────────────────────────────────────
RESET ROLE; SELECT tests.login('a2000000-0000-0000-0000-000000000003');
SELECT lives_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('a2000000-0000-0000-0000-00000000000b','MED','lesson','{}','a2000000-0000-0000-0000-000000000003',now()) $$,
  'write 권한자(teacher)는 신규 기록 INSERT 가능');
WITH u AS (UPDATE records SET content='{"h":1}' WHERE id='a2000000-0000-0000-0000-0000000000f1' RETURNING 1)
SELECT is((SELECT count(*) FROM u), 0::bigint, 'write 권한자는 기존 기록 UPDATE 불가(edit 부터 가능)');

-- ── edit 권한(therapist) ────────────────────────────────────────────────────
RESET ROLE; SELECT tests.login('a2000000-0000-0000-0000-000000000004');
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f1'),
          1::bigint, 'edit 권한자(therapist)는 SELECT 가능');
WITH u AS (UPDATE records SET content='{"h":1}' WHERE id='a2000000-0000-0000-0000-0000000000f1' RETURNING 1)
SELECT is((SELECT count(*) FROM u), 1::bigint, 'edit 권한자는 기존 기록 UPDATE 가능(1행)');

-- ── 역할 무관성(social_worker, read) ────────────────────────────────────────
RESET ROLE; SELECT tests.login('a2000000-0000-0000-0000-000000000005');
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f1'),
          1::bigint, 'social_worker read 도 supporter read 와 동일(role 무관, access_level 로만 판정)');
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,updated_at)
     VALUES ('a2000000-0000-0000-0000-00000000000b','MED','x','{}',now()) $$,
  '42501', NULL, 'social_worker read 도 INSERT 불가');

-- ── 도메인 격리 ─────────────────────────────────────────────────────────────
RESET ROLE; SELECT tests.login('a2000000-0000-0000-0000-000000000002');  -- supporter: MED read 만 보유
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f2'),
          0::bigint, 'MED 권한자는 EDU 기록을 볼 수 없음(도메인 격리)');

-- ── 만료 권한 차단(EX: edit but valid_until=어제) ───────────────────────────
RESET ROLE; SELECT tests.login('a2000000-0000-0000-0000-000000000006');
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f1'),
          0::bigint, '만료된 권한(valid_until<오늘)은 SELECT 차단');
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('a2000000-0000-0000-0000-00000000000b','MED','x','{}','a2000000-0000-0000-0000-000000000006',now()) $$,
  '42501', NULL, '만료된 권한은 INSERT 차단');

-- ── 무권한 ──────────────────────────────────────────────────────────────────
RESET ROLE; SELECT tests.login('a2000000-0000-0000-0000-000000000007');
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f1'),
          0::bigint, '무권한 사용자는 기록을 볼 수 없음');

-- ── 보호자 구조적 전체접근(permissions 0건, guardians 링크만) ───────────────
RESET ROLE; SELECT tests.login('a2000000-0000-0000-0000-00000000000a');  -- GP
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f1'),
          1::bigint, '보호자는 permissions 없이 MED 기록 SELECT(guardians 분기)');
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f2'),
          1::bigint, '보호자는 EDU 기록도 SELECT(guardians 분기에 도메인 조건 없음 — 전 도메인)');
SELECT lives_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('a2000000-0000-0000-0000-00000000000b','WEL','note','{}','a2000000-0000-0000-0000-00000000000a',now()) $$,
  '보호자는 임의 도메인(WEL) 기록 INSERT 가능(구조적 전체접근)');
WITH u AS (UPDATE records SET content='{"g":1}' WHERE id='a2000000-0000-0000-0000-0000000000f1' RETURNING 1)
SELECT is((SELECT count(*) FROM u), 1::bigint, '보호자는 임의 기록 UPDATE 가능');
-- 위조 방지(p3_records_author_id_antiforge): 보호자가 author_id 를 당사자 id 로 위조해
-- "당사자 본인 작성분(SELF-*)"으로 둔갑시키는 INSERT 는 차단된다.
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('a2000000-0000-0000-0000-00000000000b','DAI','SELF-001','{}','a2000000-0000-0000-0000-00000000000b',now()) $$,
  '42501', NULL, '보호자는 author_id 를 당사자로 위조한 SELF-* INSERT 불가');

-- ── 당사자 자기표현(person 분기) ────────────────────────────────────────────
RESET ROLE; SELECT tests.login('a2000000-0000-0000-0000-000000000001');  -- PS
SELECT is((SELECT count(*) FROM records WHERE id='a2000000-0000-0000-0000-0000000000f3'),
          1::bigint, '당사자 본인은 자기 person 의 기록 SELECT 가능');
SELECT lives_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('a2000000-0000-0000-0000-000000000001','DAI','self','{}','a2000000-0000-0000-0000-000000000001',now()) $$,
  '당사자는 자기 기록(person_id=author=self) INSERT 가능');
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('a2000000-0000-0000-0000-000000000001','DAI','self','{}','a2000000-0000-0000-0000-00000000000a',now()) $$,
  '42501', NULL, '당사자는 author_id 를 타인으로 한 기록은 INSERT 불가');
WITH u AS (UPDATE records SET content='{"s":1}' WHERE id='a2000000-0000-0000-0000-0000000000f3' RETURNING 1)
SELECT is((SELECT count(*) FROM u), 1::bigint, '당사자는 자기가 작성한 기록 UPDATE 가능');

SELECT * FROM finish();
ROLLBACK;
