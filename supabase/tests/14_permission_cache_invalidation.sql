-- =============================================================================
-- 14_permission_cache_invalidation.sql — NF-SEC-05 권한 캐시 무효화 트리거 검증
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/14_*.sql
-- 검증: trg_zz_invalidate_permission_cache / invalidate_permission_cache()
--   (20260715000000_p3_permission_cache_invalidation)
--
-- ▶ Upstash REST 실제 호출(네트워크)은 pgTAP 으로 검증 불가 — 이 파일은
--   (a) 트리거가 permissions 의 AFTER UPDATE 에 등록돼 있는지,
--   (b) 함수가 트리거 전용(authenticated 직접 호출 불가)인지,
--   (c) 접근 관련 컬럼(is_active)이 바뀌면 net.http_post 호출이 큐에 적재되는지,
--   (d) 무관한 컬럼(updated_at)만 바뀌는 UPDATE 에서는 호출이 발생하지 않는지(WHEN 절)만 확인한다.
-- ▶ (c)/(d)는 pg_net + Vault 시크릿(redis_rest_url/redis_rest_token) 준비 시에만 검증하고,
--   미준비(로컬 등) 환경에서는 skip 한다(13_notification_dispatch_trigger.sql 방어 스타일).
-- =============================================================================
BEGIN;
SELECT plan(4);

-- ── T1. 트리거가 permissions 에 AFTER UPDATE / ROW 로 등록돼 있다 ─────────────
SELECT is(
  (SELECT count(*)::int
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'permissions'
      AND t.tgname = 'trg_zz_invalidate_permission_cache'
      AND NOT t.tgisinternal),
  1,
  'trg_zz_invalidate_permission_cache 트리거가 permissions 에 등록돼 있다');

-- ── T2. 함수는 트리거 전용 — authenticated 가 직접 호출 불가 ────────────────────
SELECT is(
  has_function_privilege('authenticated', 'invalidate_permission_cache()', 'EXECUTE'),
  false,
  'invalidate_permission_cache() 은 authenticated 가 직접 호출 불가(트리거 전용)');

-- ── T3/T4. 실제 호출 발생/미발생 검증(pg_net + Vault 준비 시에만) ────────────────
-- 조건부 emit 은 SETOF TEXT 함수로 RETURN NEXT 해야 TAP 출력이 pg_prove 로 전달된다.
CREATE OR REPLACE FUNCTION pg_temp.check_cache_invalidation()
RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_has_pgnet boolean;
  v_vault_cnt bigint := 0;
  v_person    uuid := 'c4000000-0000-0000-0000-0000000000a1';
  v_grantee   uuid := 'c4000000-0000-0000-0000-0000000000a2';
  v_perm      uuid;
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
                 WHERE name IN ('redis_rest_url','redis_rest_token') $q$
      INTO v_vault_cnt;
  END IF;

  IF NOT v_has_pgnet OR v_vault_cnt <> 2 THEN
    RETURN NEXT skip('pg_net 또는 Vault 시크릿(redis_rest_url/redis_rest_token) 미준비 — 호출 검증 skip', 2);
    RETURN;
  END IF;

  -- 대상자·수임자·권한 1건 준비.
  PERFORM tests.mk_user(v_grantee, 'teacher');
  PERFORM tests.mk_person(v_person, v_grantee, DATE '2010-01-01');
  v_perm := tests.mk_perm(v_person, v_grantee, 'EDU', 'read');

  -- T3. is_active true→false(회수) 시 net.http_post 호출이 큐에 적재된다.
  EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO v_before;
  UPDATE permissions SET is_active = false, updated_at = now() WHERE id = v_perm;
  EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO v_after;
  RETURN NEXT ok(v_after > v_before,
                 'is_active 회수 시 net.http_post 무효화 호출이 큐에 적재된다');

  -- T4. 접근 무관 컬럼(updated_at)만 바뀌는 UPDATE 는 WHEN 절에 걸려 호출을 발생시키지 않는다.
  EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO v_before;
  UPDATE permissions SET updated_at = now() WHERE id = v_perm;
  EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO v_after;
  RETURN NEXT ok(v_after = v_before,
                 'updated_at 만 바뀌는 UPDATE 는 무효화 호출을 발생시키지 않는다(WHEN 절)');
END;
$$;

SELECT * FROM pg_temp.check_cache_invalidation();

SELECT * FROM finish();
ROLLBACK;
