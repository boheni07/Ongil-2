-- P3: permission_logs actor_type 컬럼 신설 — cron 배치 발 revoke 를 사람 행위와 구분
-- 참조: 20260715010000_p3_permission_expiry_batch 검토 중 발견
--
-- 문제: log_permission_change() 는 actor_id 에 auth.uid() 를 그대로 쓴다. 지금까지는 모든
--   permissions 변경이 요청(JWT) 컨텍스트 안에서 일어나 auth.uid() 가 항상 채워졌지만,
--   process_permission_expiry() 는 pg_cron 이 SECURITY DEFINER 함수를 JWT 없이 호출하므로
--   auth.uid() 가 NULL 이다. actor_id 가 nullable 이라 INSERT 자체는 실패하지 않지만,
--   "사람이 안 건드렸다(비정상/버그로 NULL)"와 "시스템 배치가 정상적으로 처리했다(NULL)"를
--   permission_logs 만 봐서는 구분할 수 없다 — 이 테이블은 애초에 권한 변경 책임 추적용
--   감사 로그(이전 라운드에서 RLS 를 강화한 바로 그 테이블)라 이 모호함은 목적에 어긋난다.
--
-- 해결: actor_type 컬럼을 추가해 'user'/'system' 을 명시적으로 구분한다. auth.uid() 가
--   NULL 이면 'system', 아니면 'user'. 기존 행은 전부 사람이 트리거한 것이므로 DEFAULT
--   'user' 로 백필해도 정합성이 깨지지 않는다.

ALTER TABLE permission_logs
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'system'));

CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_actor_type text := CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO permission_logs(permission_id, action, actor_id, actor_type, before_state, after_state)
    VALUES (NEW.id, 'grant', v_actor_id, v_actor_type, NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO permission_logs(permission_id, action, actor_id, actor_type, before_state, after_state)
    VALUES (NEW.id,
      CASE WHEN NEW.is_active = false AND OLD.is_active = true THEN 'revoke' ELSE 'update' END,
      v_actor_id, v_actor_type, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;
