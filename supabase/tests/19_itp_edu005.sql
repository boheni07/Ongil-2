-- =============================================================================
-- 19_itp_edu005.sql — EDU-005(개별화전환계획 ITP) 전용 회귀 테스트
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/19_*.sql
-- 검증: EDU 도메인 write 권한자 INSERT·무권한자 차단·requires_confirmation=true confirmer 배정
--   (청소년전환기→주보호자) + "연령가드는 앱 레이어 전용" 경계 확인.
-- ※ ITP 의 연령가드(청소년 전환기 13~18세만)는 apps/web/.../records/itp/actions.ts 의
--   createItp() 가 isItpActiveStage() 로 검사하는 앱 레이어 체크일 뿐, records_insert RLS나
--   트리거는 record_type/생애주기를 전혀 참조하지 않는다(EDU-005도 EDU-003과 동일하게
--   domain+access_level 로만 판정). 아래 테스트③은 그 경계를 DB 레벨에서 명시적으로 검증한다
--   — 대상 연령대 밖(성인기) 당사자에게도 DB는 INSERT를 허용하며, confirmer는 실제 생애주기
--   기준(성인기→본인)으로 배정된다. 이는 결함이 아니라 설계된 책임 분리(연령가드=앱, 권한=RLS)다.
-- =============================================================================
BEGIN;
SELECT plan(5);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
SELECT tests.mk_user('b1900000-0000-0000-0000-00000000000a', 'guardian');   -- GP 주보호자(청소년전환기 PY 의 confirmer)
SELECT tests.mk_person('b1900000-0000-0000-0000-00000000000c','b1900000-0000-0000-0000-00000000000a', DATE '2011-01-01'); -- PY 청소년전환기(15세)
SELECT tests.mk_user('b1900000-0000-0000-0000-000000000001', 'person');     -- PA 성인기 셀프 당사자(대상 연령대 밖)
SELECT tests.mk_person('b1900000-0000-0000-0000-000000000001','b1900000-0000-0000-0000-000000000001', DATE '2000-01-01');
SELECT tests.mk_user('b1900000-0000-0000-0000-000000000002', 'teacher');    -- TE EDU write 권한자
SELECT tests.mk_user('b1900000-0000-0000-0000-000000000003', 'teacher');    -- OUT 무권한
SELECT tests.mk_perm('b1900000-0000-0000-0000-00000000000c','b1900000-0000-0000-0000-000000000002','EDU','write');
SELECT tests.mk_perm('b1900000-0000-0000-0000-000000000001','b1900000-0000-0000-0000-000000000002','EDU','write');  -- TE, PA 에도 EDU write(연령가드 경계 테스트용)

-- ── 작성 권한 ────────────────────────────────────────────────────────────────
SELECT tests.login('b1900000-0000-0000-0000-000000000002');  -- TE
SELECT lives_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b1900000-0000-0000-0000-00000000000c','EDU','EDU-005',
             '{"career_interest_areas":["조리"]}','b1900000-0000-0000-0000-000000000002',now()) $$,
  'EDU write 권한자(teacher)는 ITP(EDU-005) INSERT 가능');

RESET ROLE; SELECT tests.login('b1900000-0000-0000-0000-000000000003');  -- OUT
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b1900000-0000-0000-0000-00000000000c','EDU','EDU-005','{}','b1900000-0000-0000-0000-000000000003',now()) $$,
  '42501', NULL, 'EDU 권한 없는 자는 ITP(EDU-005) INSERT 불가(RLS)');

-- ── confirmer 자동 배정(requires_confirmation=true) ─────────────────────────
RESET ROLE;
SELECT tests.mk_record('b1900000-0000-0000-0000-0000000000f1','b1900000-0000-0000-0000-00000000000c',
  'b1900000-0000-0000-0000-000000000002','EDU','EDU-005', true, false);
SELECT is((SELECT confirmer_id FROM records WHERE id='b1900000-0000-0000-0000-0000000000f1'),
          'b1900000-0000-0000-0000-00000000000a'::uuid,
          '청소년전환기(대상 연령대) 당사자의 ITP confirmer 는 주보호자로 자동 지정');

-- ── 연령가드 경계 확인(③④): DB는 대상 연령대 밖(성인기)에도 INSERT를 허용 ──
SELECT lives_ok(
  $$ INSERT INTO records(id,person_id,domain,record_type,content,author_id,requires_confirmation,updated_at)
     VALUES ('b1900000-0000-0000-0000-0000000000f2','b1900000-0000-0000-0000-000000000001',
             'EDU','EDU-005','{}','b1900000-0000-0000-0000-000000000002',true,now()) $$,
  'DB 레벨에서는 대상 연령대 밖(성인기) 당사자에게도 ITP INSERT 허용됨(연령가드는 createItp 앱 레이어 전용)');
SELECT is((SELECT confirmer_id FROM records WHERE id='b1900000-0000-0000-0000-0000000000f2'),
          'b1900000-0000-0000-0000-000000000001'::uuid,
          '위 경우 confirmer 는 트리거가 실제 생애주기(성인기)로 판단해 본인으로 배정(의도된 대상 여부와 무관)');

SELECT * FROM finish();
ROLLBACK;
