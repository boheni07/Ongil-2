-- P3: persons_select — 권한 수임자(전문가) 분기 추가
-- 참조: docs/05-erd.md §4-1(persons), docs/08-record-taxonomy-workshop.md 안건2-2(EDU-005 검증 중 발견)
--
-- 발견 갭(qa-verifier, 2026-07-17, EDU-005 신규 구현 검증 중):
--   persons_select(2026-07-09 최초 정의)는 주보호자(primary_guardian_id)·guardians 관계·
--   당사자 본인(person 셀프) 3분기만 있고, permissions 테이블로 도메인 권한을 부여받은
--   전문가(교사/사회복지사/치료사/활동지원사) 분기가 없었다. 그 결과:
--     ① getBipClients/getLegClients/getTransitionPlanClients/getIspClients/getItpClients 등
--        "담당 당사자 목록" 조회가 records_select는 통과하지만 persons_select에서 막혀
--        전문가에게 항상 빈 목록으로 보였다(라이브 RLS 세션 재현으로 확인 — teacher1이 EDU
--        edit 권한을 가진 두 당사자를 persons에서 SELECT 시 0 rows).
--     ② assign_record_confirmer() 트리거가 SECURITY INVOKER(prosecdef=false)라 전문가가
--        작성한 기록(requires_confirmation=true) 제출 시 트리거 내부의 persons 조회가 같은
--        이유로 실패해 confirmer_id가 계속 NULL로 남는다 — 확인요청 알림이 발송되지 않는
--        선재 결함. 보호자가 작성한 기록만 우연히 정상 동작했다(보호자는 persons_select를
--        guardians 분기로 통과하므로).
--   두 갭 모두 EDU-005 하나만의 문제가 아니라 BIP·IEP·ISP·LEG·TRA·WEL-006 전부에 이미
--   존재하던 선재 아키텍처 갭이며, 이번 라운드의 실측 RLS 검증(개발용 postgres/superuser가
--   아닌 실제 authenticated 세션 시뮬레이션)에서 처음 드러났다.
--
-- 조치: permissions 테이블에 해당 person에 대한 활성 권한(도메인 무관, read 이상)을 보유한
-- 사용자에게 persons SELECT를 허용하는 분기를 추가한다. records_select(§4-2)가 이미
-- "활성 permissions 보유 시 도메인 무관하게 읽기 허용" 패턴을 쓰고 있어 그와 동형이다 —
-- 전문가가 이미 특정 도메인 기록을 열람할 수 있다면 그 당사자의 기본 인적사항(이름·생년월일
-- 등)을 못 보는 것 자체가 비일관적이었다.

DROP POLICY IF EXISTS persons_select ON persons;

CREATE POLICY persons_select ON persons FOR SELECT
  USING (
    auth.uid() = primary_guardian_id
    OR EXISTS (
      SELECT 1 FROM guardians
      WHERE person_id = persons.id AND user_id = auth.uid()
    )
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'person'
      AND auth.uid()::text = id::text
    )
    OR EXISTS (
      SELECT 1 FROM permissions
      WHERE permissions.person_id = persons.id
        AND permissions.grantee_id = auth.uid()
        AND permissions.is_active = true
        AND (permissions.valid_until IS NULL OR permissions.valid_until >= CURRENT_DATE)
    )
  );
