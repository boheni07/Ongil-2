-- P3: 권한 캐시 무효화 파이프라인 (NF-SEC-05) — permissions UPDATE → Redis(Upstash) DEL
-- 참조: docs/01-prd.md:230(NF-SEC-05), docs/05-erd.md §4-5④
-- 작성: backend-db
--
-- 배경: RLS 정책(records_select/insert 등)은 지금까지처럼 항상 permissions 라이브 테이블을
--   직접 조회해 즉시(always-fresh) 평가한다 — 이 캐시는 그 RLS를 "대체하지 않는다".
--   이 캐시는 애플리케이션 레이어(apps/web/src/lib/permission-cache.ts)가 "이 사용자가 이
--   당사자의 이 도메인에 접근 가능한가"를 반복 조회할 때 DB 왕복을 줄이려는 부가 최적화이며,
--   TTL(기본 5분) 만료 + 변경 시 즉시 무효화 두 축으로 정확성을 유지한다(NF-SEC-05).
--   이 마이그레이션은 그중 "변경 시 즉시 무효화" 절반(DB 트리거)을 담당한다.
--
-- 아키텍처(알림 발송 라운드 20260714030000 와 대비):
--   알림 발송은 "FCM 실패 시 Resend 폴백" 같은 응답 기반 조건 분기가 필요해 별도 Deno
--   Edge Function 을 두었다. 여기는 그런 분기가 없다 — 단순 DEL 1~2건. 따라서 Edge Function
--   없이 pg_net 으로 Upstash Redis REST API 를 트리거에서 직접 호출한다.
--   fire-and-forget 으로도 무해하다: DEL 이 유실돼도 TTL 이 결국 stale 엔트리를 만료시킨다(안전망).
--
-- Upstash REST 규격(https://upstash.com/docs/redis/features/restapi):
--   명령은 경로 세그먼트로 전달 — DEL <key> 는  POST {url}/del/{key}
--   인증은  Authorization: Bearer {token}  헤더.
--   키 'perm:{grantee}:{person}:{domain}' 의 콜론(:)은 UUID/enum 값 사이 구분자로,
--   경로에서 특수 의미가 없어 그대로 둬도 되지만(콜론은 pchar), 방어적으로 %3A 인코딩한다.
--
-- 트리거 조건: 접근 판단에 영향을 주는 컬럼(is_active, access_level, domain, valid_until)이
--   바뀐 UPDATE 에만 반응한다(WHEN 절). updated_at 만 바뀌는 등 무관한 UPDATE 는 무시해
--   불필요한 Redis 호출을 막는다. grantee_id/person_id/domain 이 바뀌면 캐시 키 자체가
--   달라지므로 OLD 키와 NEW 키 둘 다 DEL 한다.
--
-- 로컬 방어: pg_net/Vault 미탑재 환경에서도 마이그레이션이 깨지지 않도록 확장 설치·트리거
--   등록을 DO ... EXCEPTION 블록으로 감싼다(생애주기·알림 라운드 동일 패턴).

-- =========================================================================
-- 0. 필요한 Vault 시크릿 (⚠️ 마이그레이션 실행 후 수동 등록 — 값 하드코딩 금지)
--    Upstash Redis REST 엔드포인트 URL·토큰을 Vault 에 저장한다. 실제 값은 이 파일에 넣지
--    말고, 마이그레이션 적용 후 아래 SQL 을 수동 실행해 채운다:
--
--      select vault.create_secret('https://<DB>.upstash.io', 'redis_rest_url');
--      select vault.create_secret('<UPSTASH-REST-TOKEN>',    'redis_rest_token');
--
--    (교체 시 vault.update_secret 사용. 두 시크릿이 없으면 트리거는 조용히 no-op 로 종료 —
--     아래 invalidate_permission_cache() 의 NULL 가드 참조. 무효화가 스킵돼도 TTL 이 안전망.)
-- =========================================================================

-- =========================================================================
-- 1. pg_net 확장 (HTTP 비동기 호출) — 로컬 미탑재 시 스킵
-- =========================================================================
DO $net$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net 확장 설치 건너뜀(미탑재 환경 추정): %', SQLERRM;
END
$net$;

-- =========================================================================
-- 2. 무효화 트리거 함수 — permissions AFTER UPDATE 마다 Upstash DEL 호출
--    SECURITY DEFINER: Vault(vault.decrypted_secrets) 및 net.http_post 접근에 소유자
--    권한 필요. 호출자(authenticated) 권한과 무관하게 일관 동작.
-- =========================================================================
CREATE OR REPLACE FUNCTION invalidate_permission_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $fn$
DECLARE
  v_redis_url   text;
  v_redis_token text;
  v_old_key     text;
  v_new_key     text;
BEGIN
  -- Vault 에서 Upstash 엔드포인트·토큰 조회. 미설정(로컬 등)이면 조용히 종료(TTL 이 안전망).
  SELECT decrypted_secret INTO v_redis_url
    FROM vault.decrypted_secrets WHERE name = 'redis_rest_url' LIMIT 1;
  SELECT decrypted_secret INTO v_redis_token
    FROM vault.decrypted_secrets WHERE name = 'redis_rest_token' LIMIT 1;

  IF v_redis_url IS NULL OR v_redis_token IS NULL THEN
    RAISE NOTICE 'invalidate_permission_cache: Vault 시크릿(redis_rest_url/redis_rest_token) 미설정 — 무효화 스킵(TTL 만료에 위임)';
    RETURN NULL;
  END IF;

  -- 캐시 키: perm:{grantee}:{person}:{domain}. 콜론은 방어적으로 %3A 인코딩.
  v_old_key := 'perm%3A' || OLD.grantee_id || '%3A' || OLD.person_id || '%3A' || OLD.domain;
  v_new_key := 'perm%3A' || NEW.grantee_id || '%3A' || NEW.person_id || '%3A' || NEW.domain;

  -- OLD 키 DEL (fire-and-forget). Upstash REST: POST {url}/del/{key}
  PERFORM net.http_post(
    url     := v_redis_url || '/del/' || v_old_key,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_redis_token)
  );

  -- 키를 구성하는 컬럼(grantee/person/domain)이 바뀌면 NEW 키도 별도로 DEL.
  IF v_new_key <> v_old_key THEN
    PERFORM net.http_post(
      url     := v_redis_url || '/del/' || v_new_key,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_redis_token)
    );
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- 무효화 실패가 permissions UPDATE(회수·수정) 트랜잭션을 깨선 안 된다 — 로그만 남기고 통과.
  -- (TTL 이 결국 stale 엔트리를 만료시키는 안전망이 있다.)
  RAISE NOTICE 'invalidate_permission_cache 호출 실패(무시하고 진행): %', SQLERRM;
  RETURN NULL;
END
$fn$;

-- 트리거 함수는 일반 사용자 직접 호출 불가.
REVOKE ALL ON FUNCTION invalidate_permission_cache() FROM PUBLIC;

-- =========================================================================
-- 3. AFTER UPDATE 트리거 등록 — 접근 판단 관련 컬럼이 바뀐 경우에만 발동(WHEN 절)
--    trg_zz_ 접두사: 다른 AFTER 발송/무효화 트리거들과 일관, AFTER 그룹 정렬용.
-- =========================================================================
DO $trg$
BEGIN
  DROP TRIGGER IF EXISTS trg_zz_invalidate_permission_cache ON permissions;
  CREATE TRIGGER trg_zz_invalidate_permission_cache
    AFTER UPDATE ON permissions
    FOR EACH ROW
    WHEN (
      OLD.is_active   IS DISTINCT FROM NEW.is_active
      OR OLD.access_level IS DISTINCT FROM NEW.access_level
      OR OLD.domain     IS DISTINCT FROM NEW.domain
      OR OLD.valid_until IS DISTINCT FROM NEW.valid_until
      OR OLD.grantee_id IS DISTINCT FROM NEW.grantee_id
      OR OLD.person_id  IS DISTINCT FROM NEW.person_id
    )
    EXECUTE FUNCTION invalidate_permission_cache();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trg_zz_invalidate_permission_cache 등록 건너뜀: %', SQLERRM;
END
$trg$;
