-- =============================================================================
-- 13_notification_dispatch_trigger.sql — Flow-SYS-03 알림 발송 트리거 등록/발화 검증
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/13_*.sql
-- 검증: trg_zz_dispatch_notification / dispatch_notification()
--   (20260714030000_p3_notification_dispatch)
--
-- ▶ Edge Function 내부(JWT 서명·FCM·Resend 호출)는 외부 HTTP 라 pgTAP 으로 검증 불가 —
--   이 파일은 (a) 트리거가 notifications 의 AFTER INSERT 에 등록돼 있는지,
--   (b) 함수가 트리거 전용(authenticated 직접 호출 불가)인지,
--   (c) 실제 INSERT 시 net.http_post 호출이 큐(net.http_request_queue)에 적재되는지만 확인한다.
-- ▶ pg_net/Vault 시크릿 미준비(로컬 등) 환경에서는 (c)를 skip 한다(다른 테스트 파일의 방어 스타일).
-- =============================================================================
BEGIN;
SELECT plan(3);

-- ── T1. 트리거가 notifications 에 AFTER INSERT / ROW 로 등록돼 있다 ────────────
SELECT is(
  (SELECT count(*)::int
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'notifications'
      AND t.tgname = 'trg_zz_dispatch_notification'
      AND NOT t.tgisinternal),
  1,
  'trg_zz_dispatch_notification 트리거가 notifications 에 등록돼 있다');

-- ── T2. 함수는 트리거 전용 — authenticated 가 직접 호출 불가 ────────────────────
SELECT is(
  has_function_privilege('authenticated', 'dispatch_notification()', 'EXECUTE'),
  false,
  'dispatch_notification() 은 authenticated 가 직접 호출 불가(트리거 전용)');

-- ── T3. 실제 INSERT 시 net.http_post 호출이 큐에 적재된다(pg_net + Vault 준비 시에만) ─
-- 조건부 emit 은 SETOF TEXT 함수로 RETURN NEXT 해야 TAP 출력이 pg_prove 로 전달된다
-- (DO 블록 내 PERFORM 은 결과 행이 버려져 TAP 이 소실되므로 사용하지 않는다).
CREATE OR REPLACE FUNCTION pg_temp.check_dispatch_fires()
RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_has_pgnet boolean;
  v_vault_cnt bigint := 0;
  v_before    bigint := 0;
  v_after     bigint := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'net' AND c.relname = 'http_request_queue'
  ) INTO v_has_pgnet;

  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'vault' AND c.relname = 'decrypted_secrets'
  ) THEN
    EXECUTE $q$ SELECT count(*) FROM vault.decrypted_secrets
                 WHERE name IN ('project_url','service_role_key') $q$
      INTO v_vault_cnt;
  END IF;

  IF NOT v_has_pgnet OR v_vault_cnt <> 2 THEN
    RETURN NEXT skip('pg_net 또는 Vault 시크릿(project_url/service_role_key) 미준비 — 호출 발생 검증 skip', 1);
    RETURN;
  END IF;

  PERFORM tests.mk_user('b3000000-0000-0000-0000-0000000000f1', 'guardian');
  EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO v_before;

  INSERT INTO notifications(recipient_id, type, title, body, data)
  VALUES ('b3000000-0000-0000-0000-0000000000f1', 'reminder',
          '발송 트리거 테스트', '본문', jsonb_build_object('k','v'));

  EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO v_after;

  RETURN NEXT ok(v_after > v_before,
                 'notifications INSERT 시 net.http_post 호출이 큐에 적재된다');
END;
$$;

SELECT * FROM pg_temp.check_dispatch_fires();

SELECT * FROM finish();
ROLLBACK;
