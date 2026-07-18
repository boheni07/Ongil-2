-- =============================================================================
-- 05_confirmation.sql — §4-6 기록 확인(Confirmation) 트리거
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/0[1-8]_*.sql
-- 검증: trg_assign_confirmer / trg_confirmation_owner / trg_reset_confirmation_on_edit
--   (20260709040253_p0_4_rls_policies)
-- ▶ 규칙: child/youth → confirmer=주보호자, adult → confirmer=본인(person_id).
--         confirmer 아닌 자가 confirmed_at 변경 시 예외. 확정 기록 content 수정 시 재확인 초기화.
-- =============================================================================
BEGIN;
SELECT plan(7);

-- 미성년 당사자 PC(주보호자 GP, 공동보호자 G2) + TH 작성 확인대상 기록 R1(EDU)
SELECT tests.mk_user('a5000000-0000-0000-0000-00000000000a', 'guardian');   -- GP primary(=child 의 confirmer)
SELECT tests.mk_user('a5000000-0000-0000-0000-00000000000b', 'guardian');   -- G2 non-primary(비confirmer)
SELECT tests.mk_user('a5000000-0000-0000-0000-000000000004', 'therapist');  -- TH 작성자
SELECT tests.mk_person('a5000000-0000-0000-0000-00000000000c','a5000000-0000-0000-0000-00000000000a', DATE '2015-01-01'); -- PC child
SELECT tests.mk_guardian_link('a5000000-0000-0000-0000-00000000000a','a5000000-0000-0000-0000-00000000000c', true);
SELECT tests.mk_guardian_link('a5000000-0000-0000-0000-00000000000b','a5000000-0000-0000-0000-00000000000c', false);
SELECT tests.mk_record('a5000000-0000-0000-0000-0000000000f1','a5000000-0000-0000-0000-00000000000c','a5000000-0000-0000-0000-000000000004','EDU','iep', true, false);

-- 성년 셀프 당사자 PA + THA(edit) 작성 확인대상 기록 R2(MED)
SELECT tests.mk_user('a5000000-0000-0000-0000-000000000001', 'person');     -- PA adult
SELECT tests.mk_person('a5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001', DATE '2000-01-01');
SELECT tests.mk_user('a5000000-0000-0000-0000-000000000005', 'therapist');  -- THA
SELECT tests.mk_perm('a5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000005','MED','edit');
SELECT tests.mk_record('a5000000-0000-0000-0000-0000000000f2','a5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000005','MED','therapy_plan', true, false);

-- ── ① 확인 주체 자동 지정 ───────────────────────────────────────────────────
SELECT is((SELECT confirmer_id FROM records WHERE id='a5000000-0000-0000-0000-0000000000f1'),
          'a5000000-0000-0000-0000-00000000000a'::uuid,
          'child 기록의 confirmer 는 주보호자로 자동 지정(trg_assign_confirmer)');
SELECT is((SELECT confirmer_id FROM records WHERE id='a5000000-0000-0000-0000-0000000000f2'),
          'a5000000-0000-0000-0000-000000000001'::uuid,
          'adult 기록의 confirmer 는 당사자 본인(person_id)으로 자동 지정');

-- ── ② confirmer 소유자 검증 ────────────────────────────────────────────────
-- 비confirmer(공동보호자 G2)는 records_update RLS(guardians 분기)는 통과하지만 트리거가 예외
RESET ROLE; SELECT tests.login('a5000000-0000-0000-0000-00000000000b');  -- G2
SELECT throws_ok(
  $$ UPDATE records SET confirmed_at = now() WHERE id='a5000000-0000-0000-0000-0000000000f1' $$,
  'P0001', NULL,
  '비confirmer(공동보호자)가 confirmed_at 변경 시 trg_confirmation_owner 예외');

-- confirmer 본인(주보호자 GP)은 성공
RESET ROLE; SELECT tests.login('a5000000-0000-0000-0000-00000000000a');  -- GP = confirmer
SELECT lives_ok(
  $$ UPDATE records SET confirmed_at = now() WHERE id='a5000000-0000-0000-0000-0000000000f1' $$,
  'confirmer 본인(주보호자)은 confirmed_at 설정 성공');
RESET ROLE;
SELECT isnt((SELECT confirmed_at FROM records WHERE id='a5000000-0000-0000-0000-0000000000f1'),
            NULL, '확인 후 confirmed_at 가 설정됨');

-- ── ③ 확정 기록 content 수정 시 재확인 초기화 ───────────────────────────────
SELECT tests.login('a5000000-0000-0000-0000-00000000000a');  -- GP 가 content 수정
UPDATE records SET content = '{"note":"revised"}' WHERE id='a5000000-0000-0000-0000-0000000000f1';
RESET ROLE;
SELECT is((SELECT confirmed_at FROM records WHERE id='a5000000-0000-0000-0000-0000000000f1'),
          NULL, '확정된 기록의 content 를 수정하면 confirmed_at 이 NULL 로 초기화(재확인 요청)');

-- ── FINDING: adult 본인 확인은 records_update RLS(author_id 한정)에 막힘 ─────
-- R2 는 THA(전문가)가 작성 → PA(confirmer=본인)는 author 가 아니므로 records_update person 분기
-- (author_id=auth.uid)에 걸려 UPDATE 대상 0행. 즉 트리거에 닿기도 전에 RLS 로 차단된다.
-- → 성년 당사자의 공식기록 확인은 클라이언트 직접 UPDATE 불가, service_role/Edge 경로 필요.
RESET ROLE; SELECT tests.login('a5000000-0000-0000-0000-000000000001');  -- PA
WITH u AS (UPDATE records SET confirmed_at = now() WHERE id='a5000000-0000-0000-0000-0000000000f2' RETURNING 1)
SELECT is((SELECT count(*) FROM u),
          0::bigint,
          'FINDING: adult 본인은 전문가 작성 기록을 records_update RLS(author 한정)로 확인 불가(0행) — service_role 경로 필요');

SELECT * FROM finish();
ROLLBACK;
