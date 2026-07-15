-- =============================================================================
-- 16_notification_preferences_permission_presets_rls.sql — §4-13 notification_preferences / §4-14 permission_presets
-- 실행: psql -f supabase/tests/00_helpers.sql (1회) 후  pg_prove -d "$DB" supabase/tests/1[0-9]_*.sql
-- 검증: RLS 활성(20260715030000_p3_notif_prefs_presets_rls) 후의 정상(방어된) 동작
--   - notification_preferences: 본인만 SELECT/INSERT/UPDATE, user_id 위조·이관 차단, 타인 설정 변조 불가, DELETE 불가
--   - permission_presets: 인증 사용자 전체 SELECT 허용(공유 참조), 쓰기(INSERT/UPDATE/DELETE) 전면 차단
--
-- ⚠️ 정정 이력: 두 테이블 모두 원래 RLS 미활성 + authenticated 전권 GRANT 상태로(이 프로젝트에서
--     6번째 반복된 동일 계열 결함), 임의 인증 사용자가 타인의 알림 채널 설정을 변조하거나
--     위자드 참조 프리셋을 임의 UPDATE/DELETE 할 수 있었다. p3 마이그레이션이 RLS 활성 +
--     notif_prefs 본인 한정 / presets 읽기전용(쓰기 service_role) 으로 봉쇄.
-- =============================================================================
BEGIN;
SELECT plan(12);

-- ── 픽스처 ───────────────────────────────────────────────────────────────────
SELECT tests.mk_user('b6000000-0000-0000-0000-000000000001', 'guardian');   -- U1 본인
SELECT tests.mk_user('b6000000-0000-0000-0000-000000000002', 'supporter');  -- U2 타인

-- =========================================================================
-- notification_preferences
-- =========================================================================

-- NP1. U1 은 본인 명의로 설정 행 생성 가능
SELECT tests.login('b6000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$ INSERT INTO notification_preferences(id, user_id, type, fcm_enabled, email_enabled, updated_at)
     VALUES ('b6000000-0000-0000-0000-0000000000a1','b6000000-0000-0000-0000-000000000001','reminder', true, true, now()) $$,
  'U1 은 본인 알림 설정을 생성 가능');

-- NP2. U1 이 타인(U2) 명의로 설정 행 생성 불가 — WITH CHECK 위반(42501)
SELECT throws_ok(
  $$ INSERT INTO notification_preferences(user_id, type, fcm_enabled, email_enabled, updated_at)
     VALUES ('b6000000-0000-0000-0000-000000000002','handover', true, true, now()) $$,
  '42501', NULL, '타인 user_id 로 알림 설정 생성 불가(WITH CHECK)');

-- NP3. U1 은 자기 설정을 열람 가능
SELECT is((SELECT count(*) FROM notification_preferences WHERE user_id='b6000000-0000-0000-0000-000000000001'),
          1::bigint, 'U1 은 자기 알림 설정을 열람 가능');

-- NP4. U2 는 U1 의 설정을 열람 불가
RESET ROLE; SELECT tests.login('b6000000-0000-0000-0000-000000000002');
SELECT is((SELECT count(*) FROM notification_preferences WHERE user_id='b6000000-0000-0000-0000-000000000001'),
          0::bigint, '본인이 아니면 타인 알림 설정 열람 불가');

-- NP5. U1 은 자기 설정의 채널 값을 갱신 가능
RESET ROLE; SELECT tests.login('b6000000-0000-0000-0000-000000000001');
SELECT lives_ok(
  $$ UPDATE notification_preferences SET email_enabled=false, updated_at=now()
     WHERE id='b6000000-0000-0000-0000-0000000000a1' $$,
  'U1 은 자기 설정의 채널 값을 변경 가능');

-- NP6. user_id(소유권 컬럼) 는 UPDATE 불가 — 컬럼 GRANT 제외(42501)
SELECT throws_ok(
  $$ UPDATE notification_preferences SET user_id='b6000000-0000-0000-0000-000000000002'
     WHERE id='b6000000-0000-0000-0000-0000000000a1' $$,
  '42501', NULL, 'user_id 는 UPDATE 불가(소유권 이관 차단, 컬럼 GRANT)');

-- NP7. U2 는 U1 의 설정을 변조 불가(USING user_id 불일치 → 0행)
RESET ROLE; SELECT tests.login('b6000000-0000-0000-0000-000000000002');
SELECT is(
  (WITH u AS (UPDATE notification_preferences SET fcm_enabled=false
              WHERE id='b6000000-0000-0000-0000-0000000000a1' RETURNING 1) SELECT count(*) FROM u),
  0::bigint, '타인 알림 설정은 변조 불가');

-- NP8. 알림 설정은 DELETE 불가(REVOKE, 42501) — 본인조차(행 삭제 대신 채널 false 로)
RESET ROLE; SELECT tests.login('b6000000-0000-0000-0000-000000000001');
SELECT throws_ok(
  $$ DELETE FROM notification_preferences WHERE id='b6000000-0000-0000-0000-0000000000a1' $$,
  '42501', NULL, '알림 설정은 DELETE 불가(GRANT 회수)');

-- =========================================================================
-- permission_presets (역할별 기본 프리셋 — p0_4 마이그레이션에서 11행 시드됨)
-- =========================================================================

-- PP1. 인증 사용자는 프리셋을 열람 가능(공유 참조 데이터) — supporter 프리셋 존재
SELECT cmp_ok(
  (SELECT count(*) FROM permission_presets WHERE role='supporter'),
  '>', 0::bigint, '인증 사용자는 역할별 프리셋을 열람 가능(공유 참조)');

-- PP2. 프리셋 UPDATE 불가 — 쓰기 privilege 회수(42501)
SELECT throws_ok(
  $$ UPDATE permission_presets SET access_level='edit' WHERE role='supporter' AND domain='MED' $$,
  '42501', NULL, '프리셋 UPDATE 불가(과다권한 주입 차단, service_role 전용)');

-- PP3. 프리셋 INSERT 불가 — 쓰기 privilege 회수(42501)
SELECT throws_ok(
  $$ INSERT INTO permission_presets(role, domain, access_level, default_valid_days)
     VALUES ('supporter','LEG','edit',9999) $$,
  '42501', NULL, '프리셋 INSERT 불가(service_role 전용)');

-- PP4. 프리셋 DELETE 불가 — 쓰기 privilege 회수(42501)
SELECT throws_ok(
  $$ DELETE FROM permission_presets WHERE role='supporter' AND domain='MED' $$,
  '42501', NULL, '프리셋 DELETE 불가(위자드 파손 차단, service_role 전용)');

SELECT * FROM finish();
ROLLBACK;
