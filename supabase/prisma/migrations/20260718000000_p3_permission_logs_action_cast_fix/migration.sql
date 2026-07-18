-- P3: log_permission_change() — CASE 표현식 enum 캐스트 누락 수정
-- 참조: supabase/tests/03_permissions.sql, 15_permission_expiry_batch.sql
--
-- 발견 경위(2026-07-18, CTO팀 갭분석 Wave B-1 — pgTAP 하네스를 처음으로 실제 완주시키는 과정에서
--   드러남. 이전까지는 fixture 이메일 충돌로 테스트가 이 지점에 도달한 적이 없었다):
--
--   20260715020000_p3_permission_logs_actor_type 이 log_permission_change()의 UPDATE 분기를
--   다음과 같이 재정의했다:
--     CASE WHEN NEW.is_active = false AND OLD.is_active = true THEN 'revoke' ELSE 'update' END
--   INSERT 분기의 단일 리터럴 'grant'는 "unknown" 타입으로 남아 대상 컬럼(PermissionLogAction
--   enum)에 암시적 할당 캐스트가 적용되지만, CASE 표현식은 두 분기 리터럴을 먼저 자체적으로
--   text로 확정한 뒤 그 결과를 INSERT하므로 text→enum 암시적 캐스트가 없어 다음 오류로 실패한다:
--     ERROR: column "action" is of type "PermissionLogAction" but expression is of type text
--
--   영향 범위: 이 트리거는 permissions 테이블 UPDATE마다 발동한다 — 즉 **보호자가 권한을
--   회수(revoke)하거나 수정할 때마다, 그리고 process_permission_expiry() 배치(F-G-10, 매일
--   자동 만료 처리)가 만료 권한을 is_active=false로 일괄 UPDATE할 때마다** 이 오류로 실패한다.
--   INSERT(권한 신규 부여)만 우연히 동작해 왔다. 2026-07-15 이후 사흘간 이 상태였다 — 이전
--   security-rls 검토("결함 없음")는 pg_prove 미설치로 정적 검토에 그쳐 실제 실행 검증이
--   없었기 때문에 놓쳤다(CLAUDE.md 2026-07-15 항목 참조).
--
-- 조치: CASE 표현식 결과를 명시적으로 ::"PermissionLogAction"으로 캐스트한다.

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
      (CASE WHEN NEW.is_active = false AND OLD.is_active = true THEN 'revoke' ELSE 'update' END)::"PermissionLogAction",
      v_actor_id, v_actor_type, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;
