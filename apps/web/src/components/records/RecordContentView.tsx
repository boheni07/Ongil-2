/**
 * G-20 기록 상세의 "원본 기록 내용" 렌더러 — 16개 record_type의 content JSONB를
 * 한글 라벨 + 값 포맷팅으로 표시한다. 이전에는 `Object.entries(content)`를 그대로
 * `<dt>{key}</dt><dd>{JSON.stringify(value)}</dd>`로 찍어 영문 필드명·비정형 텍스트가
 * 그대로 노출됐다(2026-07-18 Wave D-1 스팟체크 발견). packages/validation/src/records.ts의
 * 모든 스키마를 훑어 필드 키 → 한글 라벨, enum 값 → 한글 라벨 사전을 만들고, 배열/객체를
 * 재귀적으로 들여쓰기해 표시한다. 16종 각각 전용 뷰를 만드는 대신(과잉설계) 하나의 범용
 * 재귀 렌더러로 해소했다 — 신규 record_type이 추가돼도 라벨 사전만 채우면 된다.
 */

const FIELD_LABEL: Record<string, string> = {
  mood: "기분",
  meal: "식사",
  meal_photo_url: "식사 사진",
  activities: "활동",
  health: "건강 상태",
  memo: "메모",
  voice_url: "음성 메모",
  service_date: "서비스 일자",
  start_time: "시작 시간",
  end_time: "종료 시간",
  scheduled_hours: "계획 시간",
  service_hours: "실적 시간",
  health_status: "건강 상태",
  meal_status: "식사 상태",
  incidents: "특이사항",
  handover_note: "인수인계 메모",
  reference_journal_id: "참조 일지",
  domain: "분야",
  title: "제목",
  body: "내용",
  school: "학교",
  academic_year: "학년도",
  meeting_date: "회의 날짜",
  meetingDate: "회의 일시",
  participants: "참석자",
  current_levels: "현재 수준",
  korean: "국어",
  math: "수학",
  social: "사회성",
  communication: "의사소통",
  self_care: "자조기술",
  annual_goals: "연간 목표",
  area: "영역",
  goal: "목표",
  goals: "목표",
  short_term_goals: "단기 목표",
  period: "기간",
  evaluation: "평가 방법",
  achievement_rate: "달성률",
  evaluation_note: "평가 메모",
  support_services: "지원 서비스",
  service: "서비스",
  provider: "제공기관",
  frequency: "빈도",
  transition_plan: "전환계획",
  steps: "단계",
  observedAt: "관찰 일시",
  situation: "관찰 상황",
  tags: "태그",
  note: "메모",
  linkedGoalArea: "연결된 목표 영역",
  target_behavior: "중재 대상 행동",
  behavior_function: "행동 기능",
  fba_basis: "기능평가 근거",
  antecedent_strategies: "선행사건 중재 전략",
  replacement_behavior: "대체행동",
  reinforcement_plan: "강화 계획",
  crisis_procedure: "위기대응 절차",
  review_date: "재검토 예정일",
  career_interest_areas: "진로 흥미영역",
  work_experience_log: "현장실습 이력",
  activity: "활동명",
  next_step_note: "인계 메모",
  next_review_date: "다음 검토일",
  plan_period: "치료 기간",
  diagnosis: "진단명",
  therapy_type: "치료 유형",
  long_term: "장기 목표",
  short_term: "단기 목표",
  target_score: "목표 점수",
  session_frequency: "회기 빈도",
  responsible_therapist: "담당 치료사",
  precautions: "주의사항",
  session_date: "회기 일자",
  therapy_plan_id: "연결된 치료계획서",
  session_number: "회기 차수",
  planned_goals: "계획된 목표",
  actual_progress: "실제 진행 내용",
  domain_scores: "영역별 점수",
  physical: "신체",
  language: "언어",
  cognitive: "인지",
  observations: "관찰 내용",
  next_session_plan: "다음 회기 계획",
  eval_type: "평가 유형",
  eval_date: "평가 일자",
  score: "점수",
  summary: "종합 요약",
  recommendations: "권고사항",
  service_period: "지원 기간",
  reassessment_date: "재사정 예정일",
  case_manager: "담당자",
  assessment_tool: "사정 도구",
  needs: "욕구",
  barriers: "장애요인",
  responsible: "담당",
  deadline: "기한",
  services: "서비스 목록",
  service_name: "서비스명",
  start_date: "시작일",
  end_date: "종료일",
  status: "상태",
  monthly_cost: "월 비용",
  funding_source: "재원",
  roadmap_stage: "로드맵 단계",
  career_goal: "희망 진로",
  independent_living_plan: "자립생활 계획",
  training_records: "훈련 이력",
  program: "훈련 프로그램",
  linked_agencies: "연계 기관",
  report_kind: "보고 구분",
  report_period: "보고 기간",
  guardian_type: "후견 유형",
  guardian_name: "후견인 성명",
  property_management_summary: "재산관리 현황",
  personal_care_summary: "신상보호 현황",
  next_report_due: "다음 보고 예정일",
  consultedAt: "상담 일시",
  issueType: "상담 유형",
  content: "상담 내용",
  actionTaken: "취한 조치",
  referralAgency: "연계 기관",
  discussion: "논의 내용",
  decisions: "결정사항",
  start: "시작",
  end: "종료",
};

/** 필드 키 → { enum 값 → 한글 라벨 }. 같은 키를 쓰는 서로 다른 enum(예: status)은 값이
 * 겹치지 않아 하나로 합쳤다(training_records.status vs WEL-005 services.status). */
const ENUM_LABEL: Record<string, Record<string, string>> = {
  mood: { good: "좋음", neutral: "보통", sad: "슬픔", angry: "화남" },
  meal: { full: "완식", partial: "부분 섭취", none: "미섭취" },
  health: { good: "양호", sick: "아픔", tired: "피곤" },
  health_status: { good: "양호", sick: "아픔", tired: "피곤" },
  meal_status: { full: "완식", partial: "부분 섭취", none: "미섭취" },
  gender: { M: "남", F: "여", other: "기타" },
  activities: { exercise: "운동", study: "학습", craft: "공예", social: "사회활동" },
  behavior_function: { attention: "관심획득", escape: "회피", sensory: "감각추구", other: "기타" },
  fba_basis: {
    observation: "직접 관찰기록",
    guardian_interview: "학부모 면담",
    teacher_interview: "교사 면담",
    checklist: "체크리스트",
  },
  therapy_type: {
    physical: "물리치료",
    occupational: "작업치료",
    speech: "언어치료",
    psychological: "심리치료",
    other: "기타",
  },
  eval_type: { initial: "초기", interim: "중간", final: "최종" },
  status: {
    planned: "예정",
    ongoing: "진행중",
    completed: "완료",
    active: "이용중",
    paused: "일시중지",
    ended: "종료",
  },
  roadmap_stage: { exploration: "탐색", planning: "계획", training: "훈련", employment: "취업/자립" },
  guardian_type: { adult: "성년후견", limited: "한정후견", specific: "특정후견", voluntary: "임의후견" },
  report_kind: { initial: "최초 보고", periodic: "정기 보고" },
  issueType: {
    rights_violation: "인권침해",
    discrimination: "차별",
    abuse_suspected: "학대의심",
    other: "기타",
  },
};

function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? key;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 원시값 하나를 문자열로 — enum이면 한글 라벨, 아니면 그대로. */
function formatPrimitive(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "string") return ENUM_LABEL[key]?.[v] ?? v;
  return String(v);
}

/** 값 하나를 렌더 — 배열/객체는 재귀, 원시값은 라벨 매핑 후 텍스트로. */
function RenderValue({ fieldKey, value, depth }: { fieldKey: string; value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">없음</span>;
    const primitiveArray = value.every((v) => !isPlainObject(v) && !Array.isArray(v));
    if (primitiveArray) {
      return <span>{value.map((v) => formatPrimitive(fieldKey, v)).join(", ")}</span>;
    }
    return (
      <ul className="flex flex-col gap-2">
        {value.map((item, i) => (
          <li key={i} className="rounded-(--br-sm) border border-border p-2.5">
            {isPlainObject(item) ? (
              <ObjectFields obj={item} depth={depth + 1} />
            ) : (
              formatPrimitive(fieldKey, item)
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (isPlainObject(value)) {
    return <ObjectFields obj={value} depth={depth + 1} />;
  }

  return <span>{formatPrimitive(fieldKey, value)}</span>;
}

function ObjectFields({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <dl className={depth > 0 ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-caption font-semibold text-muted-foreground">{fieldLabel(k)}</dt>
          <dd className="mt-0.5 text-body text-foreground">
            <RenderValue fieldKey={k} value={v} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** G-20 상세 우측 패널 "원본 기록 내용" 본문. content가 객체가 아니면 안내만 표시한다. */
export function RecordContentView({ content }: { content: unknown }) {
  if (!isPlainObject(content)) {
    return <p className="text-body text-muted-foreground">표시할 내용이 없습니다.</p>;
  }
  return <ObjectFields obj={content} depth={0} />;
}
