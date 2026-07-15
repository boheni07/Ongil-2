-- P3: notification_preferences / permission_presets RLS 핫픽스 — qa-verifier 갭 분석에서 발견
-- 참조: docs/05-erd.md §4-13, §4-14 / docs/01-prd.md NF-SEC-01("모든 테이블에 행 수준 보안 정책 강제")
-- 작성: security-rls
--
-- ⚠️ 발견된 실제 상태(consents·guardians·permission_logs·handover_notes/notifications 에 이어
--    이 프로젝트에서 6번째로 반복된 동일 계열의 실사용 결함):
--   notification_preferences / permission_presets 두 테이블 모두
--   (1) 20260709035541_init_13_tables 에서 테이블만 생성되고 ENABLE ROW LEVEL SECURITY 가 전무.
--   (2) 20260709041005_p0_4_rls_grants 에서 authenticated 에 SELECT/INSERT/UPDATE/DELETE 전권 GRANT.
--   → 이후 전체 마이그레이션 히스토리에 이 두 테이블의 ENABLE RLS·CREATE POLICY 가 전무.
--     RLS 자체가 꺼져 있으므로(정책 부재가 아니라 ENABLE 부재) 임의의 로그인 사용자가:
--       · notification_preferences: 타인의 알림 채널 설정을 열람·변조 → F-G-10 등 보안 알림을 임의 비활성화 가능.
--       · permission_presets: G-32 권한 부여 위자드가 참조하는 역할별 기본 프리셋을 UPDATE(과다권한 주입)/
--         DELETE(위자드 파손) 가능.
--   본 마이그레이션이 RLS 를 켜고, notif_prefs 는 본인 한정, presets 는 "읽기=인증 전체 / 쓰기=관리자(service_role)"
--   패턴으로 봉쇄한다.
--
-- ▶ 재발 방지: 본 라운드에 pgTAP 메타 회귀(supabase/tests/17_meta_all_tables_rls_enabled.sql)를 신설하여
--   public 스키마의 모든 테이블이 RLS on 인지 자동 단정한다 → 신규 테이블의 동일 결함을 조기 차단.

-- =========================================================================
-- §4-13. notification_preferences 테이블 (사용자별 알림 채널 설정 — users FK)
-- =========================================================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 설정만.
CREATE POLICY notif_prefs_select ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: 본인 명의(user_id = auth.uid())로만. 온보딩/설정화면이 자기 행을 생성한다.
--   → 타인 user_id 로 설정 행을 심어 알림을 오염시키는 것을 차단.
CREATE POLICY notif_prefs_insert ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 본인 설정만 갱신. WITH CHECK 로 user_id 이관(다른 사람에게 넘기기)도 차단.
CREATE POLICY notif_prefs_update ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_id 는 소유권 식별자이므로 UPDATE 대상에서 제외(위조 차단). 나머지 설정 컬럼만 갱신 허용.
REVOKE UPDATE ON notification_preferences FROM authenticated;
GRANT  UPDATE (type, fcm_enabled, email_enabled, updated_at) ON notification_preferences TO authenticated;

-- DELETE 정책 없음 → 설정 행 삭제는 워크플로우에 없음(행이 없으면 §2-11-1 기본값으로 해석되므로
--   삭제 대신 fcm_enabled/email_enabled 를 false 로 두면 된다). privilege 도 명시적으로 회수.
REVOKE DELETE ON notification_preferences FROM authenticated;

-- =========================================================================
-- §4-14. permission_presets 테이블 (역할별 기본 프리셋 — G-32 위자드 참조 데이터)
-- =========================================================================
--
-- 이 테이블은 사용자별 데이터가 아니라 "모든 인증 사용자가 공유 참조하는" 읽기 전용 참조 데이터다
-- (user_id/person_id 컬럼이 없음, PK 는 (role, domain)). 따라서 사용자별 RLS 가 아니라
-- "읽기=인증 사용자 전체 허용 / 쓰기=관리자(service_role)만" 패턴을 적용한다.
--   · service_role/postgres 는 rolbypassrls=true 이므로 아래 정책과 무관하게 시드/관리가 가능하다.
--   · authenticated 에는 SELECT 만 남기고 INSERT/UPDATE/DELETE privilege 를 전면 회수한다
--     → 위자드가 참조하는 기본값을 임의 사용자가 변조/삭제하지 못한다.

ALTER TABLE permission_presets ENABLE ROW LEVEL SECURITY;

-- SELECT: 인증 사용자 전체 허용(공유 참조 데이터).
CREATE POLICY permission_presets_select ON permission_presets FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE 정책 없음 → RLS 기본 거부. 쓰기는 service_role(BYPASSRLS) 경로로만.
--   authenticated 의 쓰기 privilege 자체를 회수해 이중으로 봉쇄한다.
REVOKE INSERT, UPDATE, DELETE ON permission_presets FROM authenticated;
