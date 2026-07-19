-- P3: users_select — 같은 당사자를 공유하는 이해관계자 간 이름 조회 허용
-- 참조: docs/12-content-fidelity-workshop.md Wave A(G-01 "최근 기록"/"권한 현황" 작성자·
-- 그란티 이름 표시), 2026-07-17 p3_persons_select_permission_holders와 동형 패턴
--
-- 발견 경위: G-01 "최근 기록"·"권한 현황" 카드에 작성자·그란티 이름을 보여주려고
-- `records.select("...,author:users!author_id(full_name)")` 조인을 실제 guardian1 세션으로
-- 시뮬레이션(REST API에 실제 로그인 JWT로 curl)했더니 author가 항상 null로 나왔다. 원인은
-- users_select_own(auth.uid()=id) 하나뿐이라 "내가 아닌 다른 사용자"의 행은 임베디드 조인이든
-- 뭐든 전부 RLS로 걸러진다는 것 — 즉 보호자가 담당 교사·치료사의 이름을 절대 못 본다.
-- 이건 G-01만의 문제가 아니라 이미 배포된 `/persons/[id]/records`(RecordManager)의 "작성자"
-- 컬럼도 동일 쿼리 패턴(`users!records_author_id_fkey`)을 쓰고 있어 처음부터 계속 null이었을
-- 것으로 추정된다(2026-07-17 persons_select 갭과 같은 계열 — 발견되지 않은 선재 결함).
-- `findGranteeByEmail`(권한부여 이메일 조회)도 같은 제약이라 이미 등록된 이해관계자조차
-- 이메일로 못 찾았을 가능성이 있다(코드 주석에 제약을 알고 있었던 흔적은 있음).
--
-- 조치: persons_select와 동형 논리로 "같은 당사자를 매개로 이미 연결된 사용자"끼리는 서로의
-- 기본 정보를 볼 수 있게 한다 — ① 내가 접근 가능한(guardians 또는 활성 permissions) 당사자의
-- 다른 보호자 ② 내가 접근 가능한 당사자에 활성 permissions를 가진 그란티(전문가) ③ 당사자
-- 본인(auth.uid())의 보호자·담당 전문가. 셋 다 "이미 이 당사자를 매개로 합법적으로 연결된
-- 사이"만 통과하므로 무관한 제3자 정보 노출은 없다.
--
-- ⚠️ 컬럼 범위: 이 정책은 행(row) 단위만 열고 컬럼은 건드리지 않는다 — users 테이블은
-- authenticated에 이미 컬럼 제한 없는 SELECT가 부여돼 있고(p0_4_rls_grants), 그 이유는
-- findGranteeByEmail(`.eq("email", ...)`)이 email 컬럼을, exportMyData가 자기 자신의
-- email/created_at을 이미 읽고 있어 컬럼을 좁히면 두 기능이 깨진다. 그 결과 이 정책이 여는
-- 행에 대해서는 email/fcm_token 등도 함께 보이게 된다(당사자를 매개로 이미 연결된 사이라
-- 위험도는 낮다고 판단했으나, 더 좁히고 싶다면 별도 라운드에서 컬럼별 뷰 분리를 검토할 것).

DROP POLICY IF EXISTS users_select_own ON users;

CREATE POLICY users_select_related ON users FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      -- users.id 가 어떤 당사자의 보호자이고, 그 당사자를 나도 보호자/권한보유자로서 접근 가능
      -- (또는 내가 바로 그 당사자 본인)
      SELECT 1 FROM guardians g
      WHERE g.user_id = users.id
        AND (
          g.person_id = auth.uid()
          OR EXISTS (SELECT 1 FROM guardians g2 WHERE g2.person_id = g.person_id AND g2.user_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM permissions p2
            WHERE p2.person_id = g.person_id AND p2.grantee_id = auth.uid() AND p2.is_active = true
          )
        )
    )
    OR EXISTS (
      -- users.id 가 어떤 당사자에 활성 권한을 가진 그란티(전문가)이고, 그 당사자를 나도 접근 가능
      SELECT 1 FROM permissions p
      WHERE p.grantee_id = users.id
        AND p.is_active = true
        AND (
          p.person_id = auth.uid()
          OR EXISTS (SELECT 1 FROM guardians g3 WHERE g3.person_id = p.person_id AND g3.user_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM permissions p3
            WHERE p3.person_id = p.person_id AND p3.grantee_id = auth.uid() AND p3.is_active = true
          )
        )
    )
  );
