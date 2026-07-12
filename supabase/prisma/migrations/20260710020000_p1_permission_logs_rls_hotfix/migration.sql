-- P1-8: permission_logs RLS 핫픽스 — pgTAP 스위트 작성 중 security-rls가 발견한 취약점
-- 참조: docs/05-erd.md §4-4, supabase/tests/04_audit_logs.sql(canary)
--
-- 발견된 문제: 20260709040253_p0_4_rls_policies가 permission_logs에
-- `ALTER TABLE permission_logs DISABLE ROW LEVEL SECURITY`를 실행했는데,
-- 바로 다음 마이그레이션(20260709041005_p0_4_rls_grants)이 authenticated에
-- SELECT/INSERT/UPDATE/DELETE를 전부 GRANT했다. RLS가 꺼져 있으면 GRANT가
-- 그대로 유효 권한이 되므로, 임의의 로그인 사용자가 모든 당사자의 권한
-- 변경 감사 로그(누가 언제 무엇을 grant/revoke/update했는지, before/after
-- jsonb 스냅샷 포함)를 열람·수정·삭제할 수 있는 상태였다 — consents·
-- guardians에서 발견했던 것과 동일한 계열의 실사용 보안 결함이다.
--
-- §4-4 원문 주석("시스템 서비스 역할에서만 접근")의 의도는 RLS 비활성이
-- 아니라 "authenticated 클라이언트가 아닌 트리거 경유로만 쓰기"였던 것으로
-- 보인다. RLS를 켜고 기존 INSERT 정책(perm_logs_insert, WITH CHECK true)은
-- 그대로 살려 트리거의 INSERT를 막지 않으면서, SELECT는 주보호자로 한정하고
-- UPDATE/DELETE는 정책을 두지 않아 불변 로그 원칙을 지킨다.

ALTER TABLE permission_logs ENABLE ROW LEVEL SECURITY;

-- 기존 perm_logs_insert(WITH CHECK true) 정책은 이전 마이그레이션에 이미 있고
-- RLS가 꺼져 있어 지금까지 평가되지 않았을 뿐이다 — ENABLE 시 그대로 적용된다.
-- trg_permission_audit가 permissions INSERT/UPDATE를 일으킨 사용자(주보호자)
-- 컨텍스트에서 실행되므로 이 정책으로 트리거의 쓰기가 계속 성립한다.

-- SELECT: 관련 permissions 행의 person에 대한 주보호자만 감사 로그를 열람 가능
-- (access_logs_select, §4-4와 동일 패턴). permission_id가 NULL(permissions 행
-- 삭제로 SET NULL된 경우)이면 결부 지을 person이 없으므로 기본 거부된다.
CREATE POLICY perm_logs_select ON permission_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      JOIN guardians g ON g.person_id = p.person_id
      WHERE p.id = permission_logs.permission_id
        AND g.user_id = auth.uid()
        AND g.is_primary = true
    )
  );

-- 불변 감사 로그: UPDATE/DELETE 정책 없음(RLS 활성 상태에서 정책 부재 = 전면 거부).
-- privilege도 명시적으로 회수해 방어 심층화(consents·invitations와 동일 관례).
REVOKE UPDATE, DELETE ON permission_logs FROM authenticated;
