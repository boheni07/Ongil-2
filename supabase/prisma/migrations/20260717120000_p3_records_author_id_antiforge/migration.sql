-- P3: records_insert — author_id 위조 방지(SELF-001 보호자 대리 작성 검토, docs/07 §5 ⑥)
-- 참조: docs/05-erd.md §4-2(records), docs/07-lifecycle-record-permission-proposal.md §5
--
-- 발견 갭(security-rls, 2026-07-17):
--   기존 records_insert 의 permissions/guardians 분기는 author_id 를 전혀 검사하지 않았다.
--   → 보호자(또는 도메인 권한 보유자)가 records(person_id=P, author_id=P) 로 INSERT 하면,
--     실제로는 보호자가 쓴 기록이 "당사자 본인(SELF-*) 작성분"으로 둔갑한다.
--     설계(§4-2 주석)가 근거로 삼는 "author_id 로 실제 작성자를 항상 구분 가능"이라는 감사 추적
--     전제가 앱 레이어에서만 성립하고 DB 레벨에서는 강제되지 않아, 클라이언트 직접 호출(PostgREST)
--     로 당사자 자기표현을 위조할 수 있었다. 라이브 DB 재현으로 확인(author_is_person=t).
--
-- 조치:
--   권한자·보호자 대리 작성이라도 author_id = auth.uid()(실제 작성자 = 자기 자신)를 강제한다.
--   record_type 을 참조하지 않는 도메인-불변 정책이므로 "도메인 단위 RLS" 패턴을 유지한다.
--   기존 앱 인서트는 전부 author_id: user.id 로 저장하므로(무브레이크), pgTAP 02_records 의
--   인서트 픽스처도 전부 author_id=행위자로 이미 준수한다.
--
-- 범위 밖(후속 권장):
--   - records_update 는 이 정책으로 pin 하지 않는다. UPDATE USING 에 author_id=auth.uid() 를 넣으면
--     보호자가 전문가 작성 공식기록을 비파괴 편집(§3-5 guardianNote)하는 정당 경로가 깨진다
--     (그 기록의 author_id 는 전문가라 보호자 uid 와 불일치). UPDATE 측 author_id 불변 보장은
--     별도 트리거(OLD.author_id = NEW.author_id 강제)로 다뤄야 하며 backend-db 와 조율 대상이다.
--   - content 출처 표시(written_by: 'self'|'guardian_proxy')는 앱 레이어 Zod 스키마 몫 — backend-db 제안.

DROP POLICY IF EXISTS records_insert ON records;

CREATE POLICY records_insert ON records FOR INSERT
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM permissions
        WHERE person_id = records.person_id
          AND grantee_id = auth.uid()
          AND domain = records.domain
          AND access_level IN ('write','edit')
          AND is_active = true
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
      )
      OR EXISTS (
        SELECT 1 FROM guardians
        WHERE person_id = records.person_id AND user_id = auth.uid()
      )
    )
    -- 위조 방지: 권한자·보호자 대리 작성이라도 author_id 는 실제 작성자(자기 자신)여야 한다.
    AND author_id = auth.uid()
    -- 당사자 본인: 자기 person(=auth.uid())에 대한, 자기가 작성자인 기록만 (자기표현 SELF-*)
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'person'
      AND person_id = auth.uid()
      AND author_id = auth.uid()
    )
  );
