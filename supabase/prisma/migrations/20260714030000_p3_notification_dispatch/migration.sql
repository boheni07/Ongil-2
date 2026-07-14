-- P3: 알림 실제 발송 파이프라인 (Flow-SYS-03) — notifications INSERT → Edge Function 호출
-- 참조: docs/04-workflow.md Flow-SYS-03, docs/05-erd.md §4-12
-- 작성: backend-db
--
-- 배경: 지금까지 여러 라운드(인수인계·생애주기·기록확인)가 notifications 에 INSERT 만 했을 뿐
--   실제 FCM 푸시·이메일 발송은 전무했다. 이 마이그레이션이 그 발송 트리거를 붙인다.
--
-- 아키텍처(Supabase 표준 — Database Webhook via pg_net + Vault):
--   notifications AFTER INSERT → dispatch_notification() 트리거 →
--   Vault 에서 project_url/service_role_key 를 읽어 net.http_post 로
--   Edge Function(dispatch-notification)을 fire-and-forget 호출.
--   FCM 실패 시 Resend 폴백은 Edge Function 내부에서 처리(pg_net 비동기 특성상
--   DB 트랜잭션 안에서 "응답 보고 분기"가 불가능해 이번엔 실제 Deno Edge Function 이 필요).
--
-- ⚠️ 이 트리거는 notifications 의 "모든" INSERT(record_new/permission_grant/handover/
--   reminder/record_confirm/life_stage_youth/life_stage_adult 전부)에 균일하게 발동한다.
--   타입별 분기 없음 — "5개 type 전부 트리거 연결"을 만족하는 가장 단순·정확한 방법.
--
-- 네이밍: 트리거 이름 trg_zz_ 접두사로 다른 AFTER 트리거(trg_zz_notify_confirmation_*)와
--   일관성 유지. (이 트리거는 notifications 테이블 자체의 INSERT 에 반응하므로 다른
--   producer 트리거와 실행 순서가 꼬일 일은 없다.)
--
-- 로컬 방어: pg_net/Vault 미탑재 환경에서도 마이그레이션이 깨지지 않도록 확장 설치와
--   트리거 등록을 DO ... EXCEPTION WHEN OTHERS 블록으로 감싼다(생애주기 라운드 패턴 동일).

-- =========================================================================
-- 0. 필요한 Vault 시크릿 (⚠️ 마이그레이션 실행 후 수동 등록 — 아래 값은 절대 하드코딩 금지)
--    Edge Function 호출 URL·인증에 쓸 project_url / service_role_key 를 Vault 에 저장한다.
--    실제 값은 이 파일에 넣지 말고, 마이그레이션 적용 후 아래 SQL 을 수동 실행해 채운다:
--
--      select vault.create_secret('https://<PROJECT-REF>.supabase.co', 'project_url');
--      select vault.create_secret('<SERVICE-ROLE-KEY>',                'service_role_key');
--
--    (키를 교체할 때는 vault.update_secret 사용. 이 두 시크릿이 없으면 트리거는 조용히
--     no-op 로 종료한다 — 아래 dispatch_notification() 의 NULL 가드 참조.)
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
-- 2. 발송 트리거 함수 — notifications AFTER INSERT 마다 Edge Function 호출
--    SECURITY DEFINER: Vault(vault.decrypted_secrets) 및 net.http_post 접근에
--    소유자 권한 필요. 호출자(authenticated)의 권한과 무관하게 일관 동작.
-- =========================================================================
CREATE OR REPLACE FUNCTION dispatch_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $fn$
DECLARE
  v_project_url      text;
  v_service_role_key text;
BEGIN
  -- Vault 에서 호출 대상 URL·인증키 조회. 미설정(로컬 등)이면 조용히 종료.
  SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_project_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE NOTICE 'dispatch_notification: Vault 시크릿(project_url/service_role_key) 미설정 — 발송 스킵';
    RETURN NULL;
  END IF;

  -- fire-and-forget: 응답을 기다리지 않는다(폴백 분기는 Edge Function 내부에서).
  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/dispatch-notification',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || v_service_role_key,
                 'Content-Type',  'application/json'
               ),
    body    := to_jsonb(NEW)
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- 발송 실패가 알림 INSERT(인앱 알림함) 트랜잭션을 깨선 안 된다 — 로그만 남기고 통과.
  RAISE NOTICE 'dispatch_notification 호출 실패(무시하고 진행): %', SQLERRM;
  RETURN NULL;
END
$fn$;

-- 트리거 함수는 일반 사용자 직접 호출 불가.
REVOKE ALL ON FUNCTION dispatch_notification() FROM PUBLIC;

-- =========================================================================
-- 3. AFTER INSERT 트리거 등록 — pg_net 미탑재 환경에서도 마이그레이션이 안 깨지도록 방어
--    (net.http_post 심볼이 없으면 함수 본문은 런타임에만 평가되므로 트리거 등록 자체는
--     안전하지만, 일관성을 위해 DO 블록으로 감싼다.)
-- =========================================================================
DO $trg$
BEGIN
  DROP TRIGGER IF EXISTS trg_zz_dispatch_notification ON notifications;
  CREATE TRIGGER trg_zz_dispatch_notification
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION dispatch_notification();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trg_zz_dispatch_notification 등록 건너뜀: %', SQLERRM;
END
$trg$;
