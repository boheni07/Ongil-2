-- P3: 셀프 가입 당사자(role=person) 본인의 persons 행 UPDATE 허용
--
-- 발견 경위: "박당사"(셀프 가입 당사자)가 /settings/profile에서 프로필 사진을 업로드했는데
-- 사회복지사/치료사 홈·타임라인 등에서 계속 사진이 안 보인다는 신고 — 조사 결과
-- updateOwnProfile 서버 액션은 users.avatar_url만 갱신하고 persons.avatar_url은 건드리지
-- 않고 있었다(users 테이블 컬럼과 persons 테이블 컬럼이 별개). 게다가 persons_update
-- 정책(20260719050000)은 guardians 관계가 있는 보호자만 허용해 설령 코드가 persons도
-- 갱신하려 시도했더라도 셀프 가입 당사자는 자기 자신의 guardians 행이 없어(persons.id=
-- primary_guardian_id=auth.uid() 모델, guardians 테이블에 별도 행을 만들지 않음) RLS가
-- 막았을 것이다 — 이번 라운드에서 앱 레이어(actions.ts)와 RLS 양쪽을 함께 고친다.
--
-- 컬럼 GRANT는 20260719050000이 이미 안전 컬럼 목록(full_name, birth_date, gender,
-- disability_types, disability_degree, emergency_info, avatar_url, updated_at)으로
-- 제한해 뒀으므로 이 정책 추가만으로 primary_guardian_id/id/is_adult 위조 위험은 없다.
DROP POLICY persons_update ON persons;

CREATE POLICY persons_update ON persons FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM guardians WHERE person_id = persons.id AND user_id = auth.uid())
    OR persons.id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM guardians WHERE person_id = persons.id AND user_id = auth.uid())
    OR persons.id = auth.uid()
  );
