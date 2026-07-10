-- P0-7: consents / invitations RLS 정책 (인증·온보딩 A-02~A-10, F-AUTH-04/08, F-G-05/08)
-- 참조: docs/05-erd.md §4-7, §4-8 / docs/01-prd.md §5-1 / docs/04-workflow.md Flow-0, Flow-1
-- 작성: security-rls
--
-- ⚠️ 발견된 실제 상태(team-lead 전제 정정):
--   consents 는 20260709041005_p0_4_rls_grants 에서 authenticated 에 SELECT/INSERT/UPDATE/DELETE
--   GRANT 를 받았으나 ENABLE ROW LEVEL SECURITY 가 어디에도 없었다.
--   → deny-all(RLS on + 정책 0)이 아니라, 정반대인 allow-all 노출:
--     모든 인증 사용자가 타인의 PIPA 동의 행을 열람·수정·삭제할 수 있는 상태였다(개인정보 유출).
--   본 마이그레이션이 RLS 를 켜고 본인 한정 정책 + 불변성(철회 컬럼만 갱신)까지 강제한다.

-- =========================================================================
-- §4-7. consents 테이블 (PIPA §22 필수/선택, §23 민감정보 별도 동의)
-- =========================================================================

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인이 행위한 동의만 (대리 동의도 user_id = 행위자이므로 동일 커버)
CREATE POLICY consents_select ON consents FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: 본인 명의로만 기록 (user_id = NULL 익명 동의 차단)
CREATE POLICY consents_insert ON consents FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 본인 행에 한함. "revoked_at 만 갱신 가능(철회, F-G-08 PIPA 권리행사)"은
--         RLS 로 컬럼을 한정할 수 없으므로 컬럼 레벨 권한으로 강제한다(아래 GRANT 참조).
CREATE POLICY consents_update ON consents FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE 정책 없음 → 불변 감사 원칙(records/access_logs 와 동일 사상, §2-8).
--   RLS 활성 상태에서 DELETE 정책 부재 = 전면 거부. privilege 도 명시적으로 회수(방어적 심층).
REVOKE DELETE ON consents FROM authenticated;

-- 철회(revoked_at) 단일 컬럼만 UPDATE 허용 — 나머지 컬럼(동의내용/버전/시각) 변조 차단
REVOKE UPDATE ON consents FROM authenticated;
GRANT  UPDATE (revoked_at) ON consents TO authenticated;

-- =========================================================================
-- §4-8. invitations 테이블 (신규 — Flow-1 권한 부여/초대, F-G-05 보호자 전용)
-- =========================================================================
-- ※ invitations 는 backend-db 가 동시 작업 중이라 본 마이그레이션 적용 시점에
--    아직 없을 수 있다. 테이블 존재를 확인한 뒤에만 적용하여 병합 순서에 강건하게 처리한다.
--    (backend-db 마이그레이션이 먼저 CREATE 하면 그대로 적용됨.)
DO $mig$
BEGIN
  IF to_regclass('public.invitations') IS NULL THEN
    RAISE NOTICE 'invitations 테이블 미존재 — invitations RLS 를 건너뜀. backend-db CREATE TABLE 병합 후 이 블록을 재적용할 것.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE invitations ENABLE ROW LEVEL SECURITY';

  -- SELECT: 인증 사용자 중 초대한 보호자 본인 또는 초대받은 당사자(이메일 일치)만.
  --   anon(미인증 A-06 초대 확인)은 여기서 허용하지 않는다 — 근거는 §4-8 문서 참조.
  --   미인증 방문자는 Route Handler(service-role)에서 token 으로만 안전 컬럼을 조회한다.
  EXECUTE $pol$
    CREATE POLICY invitations_select ON invitations FOR SELECT
      USING (
        inviter_id = auth.uid()
        OR invitee_email = (SELECT email FROM users WHERE id = auth.uid())
      )
  $pol$;

  -- INSERT: 초대 발급은 보호자 전용, 본인 명의로만 (F-G-05 권한 부여 위저드)
  EXECUTE $pol$
    CREATE POLICY invitations_insert ON invitations FOR INSERT
      WITH CHECK (
        inviter_id = auth.uid()
        AND (SELECT role FROM users WHERE id = auth.uid()) = 'guardian'
      )
  $pol$;

  -- UPDATE: 거절(및 자기 초대 마감). 초대받은 본인(이메일 일치)만, pending → accepted|declined 전이만.
  --   USING 이 status='pending' 을 요구하므로 이미 처리된 초대의 재변경은 원천 차단된다.
  --   수락(accept_invitation)은 SECURITY DEFINER 함수 경로이므로 이 RLS 와 별개로 동작한다.
  EXECUTE $pol$
    CREATE POLICY invitations_update ON invitations FOR UPDATE
      USING (
        status = 'pending'
        AND invitee_email = (SELECT email FROM users WHERE id = auth.uid())
      )
      WITH CHECK (
        status IN ('accepted','declined')
        AND invitee_email = (SELECT email FROM users WHERE id = auth.uid())
      )
  $pol$;

  -- DELETE 정책 없음 → 초대 이력 불변(만료는 status='expired' 배치로 처리).
  -- 권한: anon 은 전면 차단. authenticated 는 SELECT/INSERT + status 컬럼 UPDATE 만.
  --   ⚠️ 컬럼 레벨 제한 이유: invitations_update 의 WITH CHECK 는 "어느 컬럼이 바뀌었나"를
  --   제어하지 못한다. PostgREST 직접 PATCH 로 invitee 가 자기 초대의 domain_grants(또는
  --   role/valid_until 등)를 유리하게 변조한 뒤 accept_invitation() 을 호출하면 권한 상승이
  --   가능하다(accept_invitation 이 행의 domain_grants 를 그대로 permissions 로 전개하므로).
  --   따라서 authenticated 의 직접 UPDATE 대상 컬럼을 status 하나로 못박는다.
  --   accepted_at/accepted_by 는 accept_invitation(SECURITY DEFINER)이 owner 권한으로 쓰므로
  --   authenticated 컬럼 GRANT 대상에서 제외한다(consents.revoked_at 과 동일 사상, §4-7).
  EXECUTE 'REVOKE ALL ON invitations FROM anon';
  EXECUTE 'REVOKE UPDATE ON invitations FROM authenticated';
  EXECUTE 'GRANT  SELECT, INSERT ON invitations TO authenticated';
  EXECUTE 'GRANT  UPDATE (status) ON invitations TO authenticated';
END
$mig$;
