-- =============================================================================
-- 22_advocacy_consultation_leg002.sql — LEG-002(권익옹호상담) 전용 회귀 테스트
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/22_*.sql
-- 검증: LEG 도메인 write 권한자 INSERT·무권한자 차단·requires_confirmation=false 확인
--   (LEG-002 는 advocacyConsultationSchema 기준 일상기록이라 확인주체 배정 트리거가 발동하지 않음
--   — createGuardianshipReport 와 달리 확인주체가 아예 없어 연령가드가 있어도 confirmer 분기 자체가
--   무관하다). 앱 레이어 연령가드(성인기·노년기, isSelfConfirmingStage)는 LEG-001과 동일하게
--   createAdvocacyConsultation() 에만 있고 DB/RLS는 무관 — 아래 테스트③이 그 경계를 확인한다.
-- =============================================================================
BEGIN;
SELECT plan(4);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
SELECT tests.mk_user('b2200000-0000-0000-0000-000000000001', 'person');     -- PA 성인기 셀프 당사자(대상 연령대)
SELECT tests.mk_person('b2200000-0000-0000-0000-000000000001','b2200000-0000-0000-0000-000000000001', DATE '1995-01-01');
SELECT tests.mk_user('b2200000-0000-0000-0000-00000000000a', 'guardian');   -- GP 주보호자
SELECT tests.mk_person('b2200000-0000-0000-0000-00000000000c','b2200000-0000-0000-0000-00000000000a', DATE '2016-01-01'); -- PC 아동기(대상 연령대 밖)
SELECT tests.mk_user('b2200000-0000-0000-0000-000000000002', 'social_worker'); -- SW LEG write 권한자
SELECT tests.mk_user('b2200000-0000-0000-0000-000000000003', 'social_worker'); -- OUT 무권한
SELECT tests.mk_perm('b2200000-0000-0000-0000-000000000001','b2200000-0000-0000-0000-000000000002','LEG','write');
SELECT tests.mk_perm('b2200000-0000-0000-0000-00000000000c','b2200000-0000-0000-0000-000000000002','LEG','write');

-- ── 작성 권한 ────────────────────────────────────────────────────────────────
SELECT tests.login('b2200000-0000-0000-0000-000000000002');  -- SW
SELECT lives_ok(
  $$ INSERT INTO records(id,person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b2200000-0000-0000-0000-0000000000f1','b2200000-0000-0000-0000-000000000001',
             'LEG','LEG-002','{"consultedAt":"2026-07-18","issueType":"rights_violation","content":"상담 내용"}',
             'b2200000-0000-0000-0000-000000000002',now()) $$,
  'LEG write 권한자(social_worker)는 권익옹호상담(LEG-002) INSERT 가능');

RESET ROLE; SELECT tests.login('b2200000-0000-0000-0000-000000000003');  -- OUT
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b2200000-0000-0000-0000-000000000001','LEG','LEG-002','{}','b2200000-0000-0000-0000-000000000003',now()) $$,
  '42501', NULL, 'LEG 권한 없는 자는 권익옹호상담(LEG-002) INSERT 불가(RLS)');

-- ── requires_confirmation=false → confirmer 배정 트리거 미발동 ─────────────
RESET ROLE;
SELECT is((SELECT confirmer_id FROM records WHERE id='b2200000-0000-0000-0000-0000000000f1'),
          NULL::uuid,
          '권익옹호상담은 requires_confirmation=false 라 confirmer_id 가 NULL 로 유지됨(트리거 미발동)');

-- ── 연령가드 경계 확인: DB는 대상 연령대 밖(아동기)에도 INSERT를 허용 ───────
SELECT lives_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b2200000-0000-0000-0000-00000000000c','LEG','LEG-002','{}','b2200000-0000-0000-0000-000000000002',now()) $$,
  'DB 레벨에서는 대상 연령대 밖(아동기) 당사자에게도 LEG-002 INSERT 허용됨(연령가드는 createAdvocacyConsultation 앱 레이어 전용)');

SELECT * FROM finish();
ROLLBACK;
