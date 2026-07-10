-- P0-4 후속: RLS 정책이 실제로 평가되려면 대상 role(authenticated)에
-- 테이블 기본 권한(SELECT/INSERT/UPDATE/DELETE)이 먼저 부여되어 있어야 한다.
-- Prisma로 테이블을 생성한 경우 Supabase가 통상 project 부트스트랩 시 실행하는
-- `GRANT ... TO anon, authenticated, service_role` 구문이 누락되어 있었음
-- (검증 중 "permission denied for table records" 로 발견 — RLS 정책 자체는 정상이나
-- 테이블 권한 부여가 선행되지 않으면 RLS 평가 이전에 전부 차단됨).
--
-- service_role/postgres는 rolbypassrls=true 이므로 이 GRANT와 무관하게 RLS를 우회한다.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  users,
  persons,
  guardians,
  permissions,
  permission_logs,
  records,
  record_attachments,
  consents,
  access_logs,
  handover_notes,
  notifications,
  notification_preferences,
  permission_presets
TO authenticated;

GRANT SELECT ON persons_with_stage TO authenticated;
