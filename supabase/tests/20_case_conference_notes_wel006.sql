-- =============================================================================
-- 20_case_conference_notes_wel006.sql — WEL-006(사례회의록) 전용 회귀 테스트
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/20_*.sql
-- 검증: WEL 도메인 write 권한자 INSERT·무권한자 차단·requires_confirmation=false 확인
--   (WEL-006 은 caseConferenceNoteSchema 기준 일상기록이라 확인주체 배정 트리거가 발동하지 않음).
-- ※ WEL-006 은 생애주기 가드가 없다(모든 연령대에서 작성 가능) — 별도 연령가드 테스트 불필요.
-- =============================================================================
BEGIN;
SELECT plan(3);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
SELECT tests.mk_user('b2000000-0000-0000-0000-00000000000a', 'guardian');   -- GP
SELECT tests.mk_person('b2000000-0000-0000-0000-00000000000c','b2000000-0000-0000-0000-00000000000a', DATE '2010-01-01'); -- PC
SELECT tests.mk_user('b2000000-0000-0000-0000-000000000001', 'social_worker'); -- SW WEL write 권한자
SELECT tests.mk_user('b2000000-0000-0000-0000-000000000002', 'social_worker'); -- OUT 무권한
SELECT tests.mk_perm('b2000000-0000-0000-0000-00000000000c','b2000000-0000-0000-0000-000000000001','WEL','write');

-- ── 작성 권한 ────────────────────────────────────────────────────────────────
SELECT tests.login('b2000000-0000-0000-0000-000000000001');  -- SW
SELECT lives_ok(
  $$ INSERT INTO records(id,person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b2000000-0000-0000-0000-0000000000f1','b2000000-0000-0000-0000-00000000000c',
             'WEL','WEL-006','{"meetingDate":"2026-07-18","participants":["SW"],"discussion":"현황 점검"}',
             'b2000000-0000-0000-0000-000000000001',now()) $$,
  'WEL write 권한자(social_worker)는 사례회의록(WEL-006) INSERT 가능');

RESET ROLE; SELECT tests.login('b2000000-0000-0000-0000-000000000002');  -- OUT
SELECT throws_ok(
  $$ INSERT INTO records(person_id,domain,record_type,content,author_id,updated_at)
     VALUES ('b2000000-0000-0000-0000-00000000000c','WEL','WEL-006','{}','b2000000-0000-0000-0000-000000000002',now()) $$,
  '42501', NULL, 'WEL 권한 없는 자는 사례회의록(WEL-006) INSERT 불가(RLS)');

-- ── requires_confirmation=false → confirmer 배정 트리거 미발동 ─────────────
RESET ROLE;
SELECT is((SELECT confirmer_id FROM records WHERE id='b2000000-0000-0000-0000-0000000000f1'),
          NULL::uuid,
          '사례회의록은 requires_confirmation=false 라 confirmer_id 가 NULL 로 유지됨(트리거 미발동)');

SELECT * FROM finish();
ROLLBACK;
