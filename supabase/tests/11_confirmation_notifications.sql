-- =============================================================================
-- 11_confirmation_notifications.sql — Flow-SYS-07 확인 요청·완료 알림 트리거
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/1[01]_*.sql
-- 검증: trg_zz_notify_confirmation_request / trg_zz_notify_confirmation_done
--   (20260714010000_p2_confirmation_notifications)
-- ▶ 규칙: 확인 대상 배정 시 confirmer 에게 'requested', 확인 완료 시 author 에게 'confirmed'.
--         무관한 UPDATE 는 중복 알림 없음. content 재수정으로 재확인 대기가 되면 다시 'requested'.
-- ⚠️ "확인"만 존재 — 반려/거부 개념 없음.
-- =============================================================================
BEGIN;
SELECT plan(6);

-- ── 픽스처: child 당사자 PC(주보호자 GP=confirmer), TH(치료사)=author ──────────
SELECT tests.mk_user('b1000000-0000-0000-0000-00000000000a', 'guardian');    -- GP = confirmer
SELECT tests.mk_user('b1000000-0000-0000-0000-000000000004', 'therapist');   -- TH = author
SELECT tests.mk_person('b1000000-0000-0000-0000-00000000000c','b1000000-0000-0000-0000-00000000000a', DATE '2015-01-01');
SELECT tests.mk_guardian_link('b1000000-0000-0000-0000-00000000000a','b1000000-0000-0000-0000-00000000000c', true);

-- R1: 확인 대상·확정 기록 → seed 시 trg_assign_confirmer 로 confirmer=GP 배정,
--     동시에 trg_zz_notify_confirmation_request 가 GP 에게 'requested' 알림 1건 생성.
SELECT tests.mk_record('b1000000-0000-0000-0000-0000000000f1','b1000000-0000-0000-0000-00000000000c','b1000000-0000-0000-0000-000000000004','EDU','iep', true, false);

-- ── ① 확인 대상 배정 시 confirmer 에게 requested 알림 생성 ─────────────────────
SELECT is(
  (SELECT count(*) FROM notifications
   WHERE recipient_id = 'b1000000-0000-0000-0000-00000000000a'
     AND type = 'record_confirm'
     AND data->>'status' = 'requested'
     AND data->>'record_id' = 'b1000000-0000-0000-0000-0000000000f1'),
  1::bigint,
  '확인 대상 배정 시 confirmer(주보호자)에게 requested 알림 1건 생성');

-- ── ② 무관한 UPDATE 는 중복 requested 알림을 만들지 않음 ──────────────────────
-- 아직 미확인(confirmed_at NULL) 상태에서 content 만 수정 → confirmer/confirmed_at 불변.
SELECT tests.login('b1000000-0000-0000-0000-00000000000a');  -- GP(보호자, records_update 통과)
UPDATE records SET content = '{"note":"minor edit"}' WHERE id='b1000000-0000-0000-0000-0000000000f1';
RESET ROLE;
SELECT is(
  (SELECT count(*) FROM notifications
   WHERE recipient_id = 'b1000000-0000-0000-0000-00000000000a'
     AND data->>'status' = 'requested'
     AND data->>'record_id' = 'b1000000-0000-0000-0000-0000000000f1'),
  1::bigint,
  '미확인 상태의 무관한 UPDATE 는 requested 알림을 중복 생성하지 않음');

-- ── ③ 확인 완료 시 author 에게 confirmed 알림 생성 ────────────────────────────
SELECT tests.login('b1000000-0000-0000-0000-00000000000a');  -- GP = confirmer
UPDATE records SET confirmed_at = now() WHERE id='b1000000-0000-0000-0000-0000000000f1';
RESET ROLE;
SELECT is(
  (SELECT count(*) FROM notifications
   WHERE recipient_id = 'b1000000-0000-0000-0000-000000000004'
     AND type = 'record_confirm'
     AND data->>'status' = 'confirmed'
     AND data->>'record_id' = 'b1000000-0000-0000-0000-0000000000f1'),
  1::bigint,
  '확인 완료 시 작성자(author)에게 confirmed 알림 1건 생성');

-- ── ④ 확인 완료(confirmed_at 설정)는 requested 알림을 추가로 만들지 않음 ───────
SELECT is(
  (SELECT count(*) FROM notifications
   WHERE recipient_id = 'b1000000-0000-0000-0000-00000000000a'
     AND data->>'status' = 'requested'
     AND data->>'record_id' = 'b1000000-0000-0000-0000-0000000000f1'),
  1::bigint,
  '확인 완료 UPDATE 는 requested 알림을 추가 생성하지 않음(여전히 1건)');

-- ── ⑤ 확정 기록 content 재수정 → 재확인 대기, requested 알림 재발송 ────────────
-- trg_reset_confirmation_on_edit 가 confirmed_at 을 NULL 로 되돌리면 confirmer 는 동일하되
-- OLD.confirmed_at IS NOT NULL → NEW.confirmed_at NULL 조건으로 요청 알림이 다시 발화.
SELECT tests.login('b1000000-0000-0000-0000-00000000000a');  -- GP
UPDATE records SET content = '{"note":"revised after confirm"}' WHERE id='b1000000-0000-0000-0000-0000000000f1';
RESET ROLE;
SELECT is(
  (SELECT count(*) FROM notifications
   WHERE recipient_id = 'b1000000-0000-0000-0000-00000000000a'
     AND data->>'status' = 'requested'
     AND data->>'record_id' = 'b1000000-0000-0000-0000-0000000000f1'),
  2::bigint,
  '확정 기록 content 재수정으로 재확인 대기가 되면 requested 알림 재발송(총 2건)');

-- ── ⑥ draft → 확정 전환 시 confirmer 신규 배정과 함께 requested 알림 발화 ──────
-- draft(is_draft=true)는 seed 시 confirmer 미배정(NULL) → 알림 없음.
-- is_draft=false 로 확정하면 trg_assign_confirmer 가 confirmer 배정(NULL→값) → requested.
SELECT tests.mk_record('b1000000-0000-0000-0000-0000000000f2','b1000000-0000-0000-0000-00000000000c','b1000000-0000-0000-0000-000000000004','EDU','iep', true, true);
SELECT tests.login('b1000000-0000-0000-0000-00000000000a');  -- GP
UPDATE records SET is_draft = false WHERE id='b1000000-0000-0000-0000-0000000000f2';
RESET ROLE;
SELECT is(
  (SELECT count(*) FROM notifications
   WHERE recipient_id = 'b1000000-0000-0000-0000-00000000000a'
     AND data->>'status' = 'requested'
     AND data->>'record_id' = 'b1000000-0000-0000-0000-0000000000f2'),
  1::bigint,
  'draft 확정 시 confirmer 신규 배정과 함께 requested 알림 1건 발화');

SELECT * FROM finish();
ROLLBACK;
