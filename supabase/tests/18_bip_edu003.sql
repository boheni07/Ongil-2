-- =============================================================================
-- 18_bip_edu003.sql — EDU-003(행동중재계획 BIP) 전용 회귀 테스트
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/18_*.sql
-- 검증: EDU 도메인 write 권한자 INSERT·무권한자 차단(records_insert, 02_records.sql과 동일 정책의
--   record_type='EDU-003' 케이스)·requires_confirmation=true 에 대한 confirmer 자동 배정
--   (child→주보호자/adult→본인, trg_assign_confirmer).
-- ※ EDU-003 은 packages/validation/src/records.ts(bipSchema)·apps/web 서버 액션(createBip) 모두
--   생애주기 가드가 전혀 없다(모든 연령대에서 작성 가능한 설계) — 별도의 "연령가드" 테스트 불필요.
-- =============================================================================
BEGIN;
SELECT plan(4);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
SELECT tests.mk_user('b1800000-0000-0000-0000-00000000000a', 'guardian');   -- GP 주보호자(아동기 PC 의 confirmer)
SELECT tests.mk_person('b1800000-0000-0000-0000-00000000000c','b1800000-0000-0000-0000-00000000000a', DATE '2016-01-01'); -- PC 아동기(10세)
SELECT tests.mk_user('b1800000-0000-0000-0000-000000000001', 'person');     -- PA 성인기 셀프 당사자
SELECT tests.mk_person('b1800000-0000-0000-0000-000000000001','b1800000-0000-0000-0000-000000000001', DATE '2000-01-01');
SELECT tests.mk_user('b1800000-0000-0000-0000-000000000002', 'teacher');    -- TE EDU write 권한자
SELECT tests.mk_user('b1800000-0000-0000-0000-000000000003', 'teacher');    -- OUT 무권한
SELECT tests.mk_perm('b1800000-0000-0000-0000-00000000000c','b1800000-0000-0000-0000-000000000002','EDU','write');

-- ── 작성 권한 ────────────────────────────────────────────────────────────────
SELECT tests.login('b1800000-0000-0000-0000-000000000002');  -- TE
SELECT lives_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b1800000-0000-0000-0000-00000000000c','EDU','EDU-003',
             '{"target_behavior":"착석 유지 어려움"}','b1800000-0000-0000-0000-000000000002',now()) $$,
  'EDU write 권한자(teacher)는 BIP(EDU-003) INSERT 가능');

RESET ROLE; SELECT tests.login('b1800000-0000-0000-0000-000000000003');  -- OUT
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b1800000-0000-0000-0000-00000000000c','EDU','EDU-003','{}','b1800000-0000-0000-0000-000000000003',now()) $$,
  '42501', NULL, 'EDU 권한 없는 자는 BIP(EDU-003) INSERT 불가(RLS)');

-- ── confirmer 자동 배정(requires_confirmation=true) ─────────────────────────
RESET ROLE;
SELECT tests.mk_record('b1800000-0000-0000-0000-0000000000f1','b1800000-0000-0000-0000-00000000000c',
  'b1800000-0000-0000-0000-000000000002','EDU','EDU-003', true, false);
SELECT is((SELECT confirmer_id FROM records WHERE id='b1800000-0000-0000-0000-0000000000f1'),
          'b1800000-0000-0000-0000-00000000000a'::uuid,
          '아동기 당사자의 BIP confirmer 는 주보호자로 자동 지정');

SELECT tests.mk_record('b1800000-0000-0000-0000-0000000000f2','b1800000-0000-0000-0000-000000000001',
  'b1800000-0000-0000-0000-000000000002','EDU','EDU-003', true, false);
SELECT is((SELECT confirmer_id FROM records WHERE id='b1800000-0000-0000-0000-0000000000f2'),
          'b1800000-0000-0000-0000-000000000001'::uuid,
          '성인기 당사자의 BIP confirmer 는 본인(person_id)으로 자동 지정');

SELECT * FROM finish();
ROLLBACK;
