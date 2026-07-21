-- P2: handover_notes / notifications RLS 핫픽스 — S-20/S-21(인계인수) 구현 라운드에서 security-rls 발견
-- 참조: docs/05-erd.md §4-10, §4-11 / docs/04-workflow.md(인계인수 플로우)
-- 작성: security-rls
--
-- ⚠️ 발견된 실제 상태(consents·guardians·permission_logs 와 동일 계열의 실사용 결함):
--   handover_notes / notifications 두 테이블 모두
--   (1) 20260709035541_init_13_tables 에서 테이블만 생성되고 ENABLE ROW LEVEL SECURITY 가 전무.
--   (2) 20260709041005_p0_4_rls_grants 에서 authenticated 에 SELECT/INSERT/UPDATE/DELETE 전권 GRANT.
--   → RLS 자체가 꺼져 있으므로(정책 부재가 아니라 ENABLE 부재) 임의의 로그인 사용자가
--     모든 당사자의 모든 인계인수 노트·알림을 SELECT/INSERT/UPDATE/DELETE 가능한 상태였다
--     — 타인 인계인수 내용·알림을 열람·위조·삭제할 수 있는 개인정보/무결성 결함.
--   본 마이그레이션이 RLS 를 켜고 본인 한정 접근 + 컬럼 단위 GRANT 로 변조 표면을 봉쇄한다.

-- =========================================================================
-- §4-10. handover_notes 테이블 (인계인수 노트 — S-20 목록 / S-21 작성)
-- =========================================================================

ALTER TABLE handover_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: 받은(to)·보낸(from) 본인만. 주보호자 열람은 워크플로우에 명시되지 않아 포함하지 않는다
--   (필요 시 별도 정책 추가 — 최소 권한 원칙상 지금은 당사자 간 1:1 전달로 한정).
CREATE POLICY handover_notes_select ON handover_notes FOR SELECT
  USING (
    to_user_id = auth.uid()
    OR from_user_id = auth.uid()
  );

-- INSERT: 발신자 본인 명의로만(from_user_id = auth.uid()) + 대상 당사자에 대한 DAI(일상지원)
--   도메인 write/edit 권한 보유(records_insert 와 동일 조건) 또는 해당 person 의 보호자.
--   → 권한 없는 제3자가 임의 당사자에게 인계인수 노트를 심는 것을 차단한다.
CREATE POLICY handover_notes_insert ON handover_notes FOR INSERT
  WITH CHECK (
    from_user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM permissions
        WHERE person_id = handover_notes.person_id
          AND grantee_id = auth.uid()
          AND domain = 'DAI'
          AND access_level IN ('write','edit')
          AND is_active = true
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
      )
      OR EXISTS (
        SELECT 1 FROM guardians
        WHERE person_id = handover_notes.person_id AND user_id = auth.uid()
      )
    )
  );

-- UPDATE: 수신자 본인이 아직 미확인(acknowledged_at IS NULL)인 자기 수신 건만 확인 처리 가능.
--   USING 으로 대상 행을 한정하고, WITH CHECK 은 to_user_id 만 재확인한다.
--   ⚠️ WITH CHECK 을 명시하지 않으면 USING 이 그대로 적용되어, acknowledged_at 을 채운
--      직후의 새 행이 `acknowledged_at IS NULL = false` 로 WITH CHECK 에 걸려 확인 자체가
--      불가능해진다 — 반드시 별도 WITH CHECK 을 둔다.
CREATE POLICY handover_notes_update ON handover_notes FOR UPDATE
  USING (
    to_user_id = auth.uid()
    AND acknowledged_at IS NULL
  )
  WITH CHECK (
    to_user_id = auth.uid()
  );

-- 갱신 가능 컬럼을 acknowledged_at 하나로 못박아, 수신자가 content/priority/from_user_id 등
--   전달 내용을 사후 변조하는 것을 차단한다(consents.revoked_at·invitations.status 와 동일 사상).
REVOKE UPDATE ON handover_notes FROM authenticated;
GRANT  UPDATE (acknowledged_at) ON handover_notes TO authenticated;

-- DELETE 정책 없음 → 인계인수 기록 불변(위조·은폐 방지). privilege 도 명시적으로 회수.
REVOKE DELETE ON handover_notes FROM authenticated;

-- =========================================================================
-- §4-11. notifications 테이블 (알림 — 인계인수·확인절차 등 다기능 발신)
-- =========================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: 수신자 본인 알림만.
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- INSERT: 서로 다른 기능(인계인수·기록확인 등)이 상대방에게 알림을 보내야 하므로 발신자 제약을
--   걸기 어렵다 → WITH CHECK(true) 로 열되(perm_logs_insert 선례와 동일 판단), 쓰기 가능 컬럼을
--   (recipient_id, type, title, body, data) 로 한정해 is_read/sent_at/read_at 조작을 차단한다.
CREATE POLICY notifications_insert ON notifications FOR INSERT
  WITH CHECK (true);

-- UPDATE: 본인 알림의 읽음 상태(is_read, read_at)만 갱신 가능.
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- 컬럼 단위 GRANT: INSERT 는 안전 컬럼만, UPDATE 는 읽음 컬럼만.
REVOKE INSERT, UPDATE ON notifications FROM authenticated;
GRANT  INSERT (recipient_id, type, title, body, data) ON notifications TO authenticated;
GRANT  UPDATE (is_read, read_at) ON notifications TO authenticated;

-- DELETE 정책 없음 → 알림 삭제 기능 부재, 전면 차단. privilege 도 명시적으로 회수.
REVOKE DELETE ON notifications FROM authenticated;
