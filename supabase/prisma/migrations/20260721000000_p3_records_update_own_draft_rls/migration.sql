-- P3: 활동지원사 등 "write" 레벨 전문직군이 자기 임시저장(draft) 기록을 이어서 작성할 수 있게
-- records_update RLS에 좁은 예외 branch 추가.
--
-- 발견 갭: "활동지원사가 임시저장한 일지를 선택하면 계속 작성할 수 있는 기능이 없다" 기능
-- 요청을 구현하는 중, records_update가 'edit' 레벨 권한 보유자·보호자·당사자 본인만 UPDATE를
-- 허용한다는 걸 확인했다(20260710010000_p1_person_self_and_guardians_rls). 활동지원사는 통상
-- DAI 도메인에 'write'만 보유(일지 INSERT는 write/edit 둘 다 허용)하므로, 자기가 만든 draft를
-- 다시 저장(UPDATE)하려 하면 RLS가 막는다.
--
-- 해결: "본인이 작성자(author_id)이고 아직 임시저장(is_draft=true) 상태인 기록"에 한해 도메인
-- 접근수준과 무관하게 UPDATE를 허용하는 branch를 추가한다. 이미 제출 확정된(is_draft=false)
-- 기록에는 이 예외가 적용되지 않으므로("write만으로 확정 기록을 수정할 수 있게 됨" 같은 권한
-- 상승은 발생하지 않음), 초안을 스스로 이어 쓰는 좁은 케이스로 한정된다.

DROP POLICY IF EXISTS records_update ON records;

CREATE POLICY records_update ON records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM permissions
      WHERE person_id = records.person_id
        AND grantee_id = auth.uid()
        AND domain = records.domain
        AND access_level = 'edit'
        AND is_active = true
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = records.person_id AND user_id = auth.uid()
    )
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'person'
      AND person_id = auth.uid()
      AND author_id = auth.uid()
    )
    -- 신규: 작성자 본인의 미제출 임시저장(draft)은 도메인 접근수준과 무관하게 이어서 저장 가능.
    OR (
      author_id = auth.uid()
      AND is_draft = true
    )
  );
