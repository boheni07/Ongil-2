/**
 * G-20 기록 상세의 "원본 기록 내용" 렌더러 — 16개 record_type의 content JSONB를
 * 한글 라벨 + 값 포맷팅으로 표시한다. 이전에는 `Object.entries(content)`를 그대로
 * `<dt>{key}</dt><dd>{JSON.stringify(value)}</dd>`로 찍어 영문 필드명·비정형 텍스트가
 * 그대로 노출됐다(2026-07-18 Wave D-1 스팟체크 발견). packages/validation/src/records.ts의
 * 모든 스키마를 훑어 필드 키 → 한글 라벨, enum 값 → 한글 라벨 사전을 만들고, 배열/객체를
 * 재귀적으로 들여쓰기해 표시한다. 16종 각각 전용 뷰를 만드는 대신(과잉설계) 하나의 범용
 * 재귀 렌더러로 해소했다 — 신규 record_type이 추가돼도 라벨 사전만 채우면 된다.
 *
 * 2026-07-19 1차: Postgres jsonb는 저장 시 키 순서를 보존하지 않아 화면 순서가 뒤죽박죽으로
 * 보인다는 피드백으로 FIELD_ORDER 우선순위 맵을 도입해 상식적인 읽기 순서를 강제했다.
 *
 * 2026-07-19 2차: "아래로 계속 펼쳐지는 목록"이 아니라 일반 문서 서식처럼 보이면 좋겠다는
 * 피드백에 따라 간이 UIUX 리뷰(당사자·보호자·전문가 3개 사용자 관점 시뮬레이션)를 거쳐
 * 섹션 기반 레이아웃으로 재구성했다. 검토 결론:
 *   - 보호자 관점: "다 똑같은 굵기·줄 간격이라 어디까지가 한 덩어리인지 안 보인다" →
 *     의미 단위(개요/세부내용/측정/일정/담당자/메모)로 섹션을 나누고 섹션 제목을 둔다.
 *   - 전문가(교사·치료사) 관점: "평가 점수 같은 숫자는 목록보다 한눈에 비교되면 좋겠다" →
 *     domain_scores처럼 "분야+점수" 배열은 미니 스탯 카드(막대 그래프 포함)로 특별 렌더.
 *   - 공통: 이름·날짜 같은 짧은 값은 굳이 한 줄씩 세로로 쌓지 않고 2열로 나란히(문서의
 *     "표" 관행과 비슷하게) — 긴 서술형 텍스트만 전체 폭으로 펼친다.
 * FIELD_ORDER의 우선순위 그룹을 그대로 섹션 경계로 재사용한다(그룹 1·2=개요, 3=세부내용,
 * 4=측정·평가, 5=기타, 6=일정, 7=담당자, 8=메모).
 *
 * 2026-07-19 3차: "세로 목록 나열만 하지 말고 항목 성격에 맞춰 가로 표·그래프로도 보여달라"는
 * 피드백에 따라 배열 필드를 값의 모양에 따라 3갈래로 분기한다.
 *   - {start,end} 쌍(기간)은 어디서 나오든 "YYYY-MM-DD ~ YYYY-MM-DD" 한 줄로 압축(compactText).
 *   - 목표 배열(annual_goals/goals — IEP·ISP·치료계획서 공통)은 영역 배지+진행률 막대가 붙은
 *     목표 카드(GoalCards)로 — 서술형 본문과 달성률을 함께 보여줘야 해서 표보다 카드가 낫다.
 *   - 그 외 필드가 균일하고 짧은(≤6열, 각 칸 60자 이내) 객체 배열(지원서비스·훈련이력·현장실습
 *     이력 등)은 표(ObjectTable)로 — 이런 데이터는 행×열로 비교하는 게 자연스럽다.
 *   - domain_scores처럼 값이 전부 숫자인 고정 객체({physical,...})도 배열로 변환해 기존
 *     ScoreCards(막대 그래프)를 그대로 재사용한다(회기 일지는 배열이 아니라 고정 객체라 이전엔
 *     이 그래프 처리를 못 받았다).
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
  handover_note: "인계인수 메모",
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
  goal_area: "전환 목표 영역",
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
  // 치료계획서 goals[].area(TherapyArea) — IEP/ISP의 자유문자열 area("국어" 등)와 같은 필드
  // 키를 쓰지만 값이 겹치지 않아 안전하게 합칠 수 있다(2026-07-19, "language" 등 영어 원문이
  // 그대로 노출되던 결함 수정). domain_scores는 보통 ScoreCards로 렌더되지만 혹시 그 경로를
  // 타지 않는 경우를 대비해 domain 키도 함께 매핑해둔다.
  area: { physical: "신체", language: "언어", cognitive: "인지", social: "사회성" },
  goal_area: {
    career: "진로·직업",
    independent_living: "자립생활",
    community: "지역사회 참여",
    further_education: "계속교육",
  },
  domain: { physical: "신체", language: "언어", cognitive: "인지", social: "사회성" },
};

/**
 * 상식적인 읽기 순서 겸 섹션 그룹 — 이 기록이 "무엇에 대한 것인지"(분류·유형) → 이름·제목 →
 * 설명·목표 본문 → 점수·측정값·상태 → 일정·기간 → 담당자 → 메모·특이사항.
 * 목록에 없는 키는 5(기타)로 취급해 순서가 크게 튀지 않게 한다. 같은 우선순위 안에서는
 * 원래(객체에 들어온) 순서를 그대로 유지한다(안정 정렬).
 */
const FIELD_ORDER: Record<string, number> = {
  // 1. 분류/유형 — "무엇에 대한 기록인가"
  domain: 1,
  area: 1,
  goal_area: 1,
  therapy_type: 1,
  eval_type: 1,
  roadmap_stage: 1,
  report_kind: 1,
  issueType: 1,
  guardian_type: 1,
  mood: 1,
  meal: 1,
  health: 1,
  behavior_function: 1,
  target_behavior: 1,

  // 2. 이름/제목
  title: 2,
  service: 2,
  service_name: 2,
  program: 2,
  activity: 2,
  guardian_name: 2,
  provider: 2,
  school: 2,

  // 3. 설명·목표 본문
  body: 3,
  goal: 3,
  long_term: 3,
  short_term: 3,
  short_term_goals: 3,
  career_goal: 3,
  independent_living_plan: 3,
  summary: 3,
  content: 3,
  discussion: 3,
  situation: 3,
  current_levels: 3,
  antecedent_strategies: 3,
  replacement_behavior: 3,
  reinforcement_plan: 3,
  crisis_procedure: 3,
  property_management_summary: 3,
  personal_care_summary: 3,
  planned_goals: 3,
  actual_progress: 3,
  observations: 3,
  next_session_plan: 3,
  next_step_note: 3,
  fba_basis: 3,
  annual_goals: 3,
  support_services: 3,
  training_records: 3,
  work_experience_log: 3,
  services: 3,
  needs: 3,
  transition_plan: 3,
  steps: 3,

  // 4. 점수·측정값·상태
  score: 4,
  domain_scores: 4,
  achievement_rate: 4,
  target_score: 4,
  monthly_cost: 4,
  status: 4,

  // 6. 일정·기간
  service_date: 6,
  start_time: 6,
  end_time: 6,
  start_date: 6,
  end_date: 6,
  start: 6,
  end: 6,
  period: 6,
  service_period: 6,
  plan_period: 6,
  report_period: 6,
  meeting_date: 6,
  meetingDate: 6,
  session_date: 6,
  eval_date: 6,
  observedAt: 6,
  consultedAt: 6,
  deadline: 6,
  review_date: 6,
  next_review_date: 6,
  next_report_due: 6,
  reassessment_date: 6,
  academic_year: 6,
  scheduled_hours: 6,
  service_hours: 6,
  session_frequency: 6,
  frequency: 6,

  // 7. 담당자·관계자
  responsible: 7,
  case_manager: 7,
  responsible_therapist: 7,
  participants: 7,
  funding_source: 7,
  linked_agencies: 7,
  referralAgency: 7,
  therapy_plan_id: 7,
  session_number: 7,
  assessment_tool: 7,

  // 8. 메모·특이사항 (가장 나중)
  memo: 8,
  note: 8,
  precautions: 8,
  recommendations: 8,
  incidents: 8,
  handover_note: 8,
  actionTaken: 8,
  decisions: 8,
  evaluation: 8,
  evaluation_note: 8,
  barriers: 8,
};

/** 섹션 제목 — FIELD_ORDER 우선순위 그룹을 그대로 섹션 경계로 쓴다. */
const SECTION_GROUPS: { priorities: number[]; title: string }[] = [
  { priorities: [1, 2], title: "개요" },
  { priorities: [3], title: "세부 내용" },
  { priorities: [4], title: "측정·평가" },
  { priorities: [6], title: "일정" },
  { priorities: [7], title: "담당자" },
  { priorities: [8], title: "메모·특이사항" },
  { priorities: [5], title: "기타" },
];

function fieldOrder(key: string): number {
  return FIELD_ORDER[key] ?? 5;
}

/** [키, 값] 목록을 상식적인 읽기 순서로 정렬한다(안정 정렬 — 동순위는 원래 순서 유지). */
function sortEntries(entries: [string, unknown][]): [string, unknown][] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => fieldOrder(a.entry[0]) - fieldOrder(b.entry[0]) || a.index - b.index)
    .map(({ entry }) => entry);
}

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

/** {start, end} 꼭 두 키만 가진 객체 — 기간을 나타내는 관용 형태(plan_period·period 등). */
function isRangeObject(v: unknown): v is { start: unknown; end: unknown } {
  return isPlainObject(v) && Object.keys(v).length === 2 && "start" in v && "end" in v;
}

/** 값 하나를 "표/압축 칸"에 들어갈 한 줄 텍스트로 — 기간 객체는 물결표로, 배열은 콤마로. */
function compactText(fieldKey: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (isRangeObject(value)) {
    return `${formatPrimitive(fieldKey, value.start)} ~ ${formatPrimitive(fieldKey, value.end)}`;
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatPrimitive(fieldKey, v)).join(", ");
  }
  return formatPrimitive(fieldKey, value);
}

/** 짧은 값(이름·날짜·상태 등)인지 판단 — 짧으면 2열 표 형태로, 길면 전체 폭으로 펼친다. */
function isCompactValue(fieldKey: string, value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (isRangeObject(value)) return true;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    const primitiveArray = value.every((v) => !isPlainObject(v) && !Array.isArray(v));
    if (!primitiveArray) return false;
    return compactText(fieldKey, value).length <= 40;
  }
  if (isPlainObject(value)) return false;
  return compactText(fieldKey, value).length <= 40;
}

/** 목표 배열(영역+서술형 목표+선택적 달성률) — IEP annual_goals, ISP·치료계획서 goals 공통. */
const GOAL_ARRAY_KEYS = new Set(["annual_goals", "goals"]);

function isGoalArray(fieldKey: string, value: unknown[]): value is Record<string, unknown>[] {
  return GOAL_ARRAY_KEYS.has(fieldKey) && value.length > 0 && value.every(isPlainObject);
}

/** 값이 전부 숫자인 고정 객체(회기 일지 domain_scores 등) — 배열로 바꿔 ScoreCards로 그린다. */
function isNumericScoreObject(v: Record<string, unknown>): boolean {
  const vals = Object.values(v);
  return vals.length > 0 && vals.every((x) => typeof x === "number");
}

/** 표 한 칸에 담기 적당한 값인지 — 중첩 객체 배열·과도하게 긴 텍스트는 표를 지저분하게 만든다. */
function isTableCell(fieldKey: string, value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (isRangeObject(value)) return true;
  if (Array.isArray(value)) {
    if (!value.every((v) => !isPlainObject(v) && !Array.isArray(v))) return false;
    return compactText(fieldKey, value).length <= 60;
  }
  if (isPlainObject(value)) return false;
  return compactText(fieldKey, value).length <= 60;
}

/** 균일하고 짧은 객체 배열(지원서비스·훈련이력·현장실습 이력 등) — 행×열 표로 그리기 적합한지. */
function isTableArray(value: unknown[]): value is Record<string, unknown>[] {
  if (value.length < 2 || !value.every(isPlainObject)) return false;
  const keys = new Set(value.flatMap((it) => Object.keys(it)));
  if (keys.size === 0 || keys.size > 6) return false;
  return value.every((item) => Object.entries(item).every(([k, v]) => isTableCell(k, v)));
}

/** 값 하나를 렌더 — 배열/객체는 재귀, 원시값은 라벨 매핑 후 텍스트로. */
function RenderValue({ fieldKey, value, depth }: { fieldKey: string; value: unknown; depth: number }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">없음</span>;

    if (fieldKey === "domain_scores" && isScoreArray(value)) {
      return <ScoreCards items={value} />;
    }

    if (isGoalArray(fieldKey, value)) {
      return <GoalCards items={value} />;
    }

    if (isTableArray(value)) {
      return <ObjectTable items={value} />;
    }

    const primitiveArray = value.every((v) => !isPlainObject(v) && !Array.isArray(v));
    if (primitiveArray) {
      return <span>{value.map((v) => formatPrimitive(fieldKey, v)).join(", ")}</span>;
    }
    return (
      <ul className="flex flex-col gap-3">
        {value.map((item, i) => (
          <li key={i} className="rounded-(--br-md) border border-border bg-muted/30 p-4 shadow-sm">
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
    if (isRangeObject(value)) {
      return <span>{compactText(fieldKey, value)}</span>;
    }
    if (fieldKey === "domain_scores" && isNumericScoreObject(value)) {
      return <ScoreCards items={Object.entries(value).map(([k, v]) => ({ domain: k, score: v }))} />;
    }
    return <ObjectFields obj={value} depth={depth + 1} />;
  }

  return <span>{formatPrimitive(fieldKey, value)}</span>;
}

/** 재귀(중첩) 필드용 — 섹션 구분 없이 라벨/값을 순서대로 나열. 배열 항목·객체 내부에서 쓴다. */
function ObjectFields({ obj, depth }: { obj: Record<string, unknown>; depth: number }) {
  const entries = sortEntries(Object.entries(obj));
  if (entries.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <dl className="flex flex-col gap-3">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-bold tracking-wide text-muted-foreground/80 uppercase">
            {fieldLabel(k)}
          </dt>
          <dd className="mt-1 text-[14px] leading-relaxed font-semibold text-foreground">
            <RenderValue fieldKey={k} value={v} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface ScoreItem {
  label: string;
  value: number;
}

function isScoreArray(value: unknown[]): value is Record<string, unknown>[] {
  return value.every((v) => {
    if (!isPlainObject(v)) return false;
    return typeof v.score === "number" || typeof v.achievement_rate === "number" || typeof v.target_score === "number";
  });
}

/** domain_scores처럼 "분야 + 점수" 배열은 목록 대신 막대그래프가 붙은 미니 스탯 카드로 보여준다
 * (2026-07-19 UIUX 리뷰 — 전문가 사용자는 점수를 목록보다 한눈에 비교하고 싶어했다). */
function ScoreCards({ items }: { items: Record<string, unknown>[] }) {
  const scores: ScoreItem[] = items.map((it, i) => {
    const rawLabel = (it.domain as string) ?? (it.area as string) ?? `항목 ${i + 1}`;
    const value = (it.score as number) ?? (it.achievement_rate as number) ?? (it.target_score as number) ?? 0;
    return { label: fieldLabel(rawLabel), value };
  });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {scores.map((s, i) => (
        <div key={i} className="rounded-(--br-md) border border-border bg-white p-3.5 shadow-sm">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground/80 uppercase">{s.label}</p>
          <p className="mt-1 text-2xl font-extrabold text-primary-700">
            {s.value}
            <span className="ml-0.5 text-xs font-semibold text-muted-foreground">점</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary-600"
              style={{ width: `${Math.min(100, Math.max(0, s.value))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 목표 배열 카드에서 주요 필드(영역/목표문/진행률)를 뺀 나머지를 압축 나열한다. */
function GoalMetaFields({ item, exclude }: { item: Record<string, unknown>; exclude: string[] }) {
  const rest = sortEntries(
    Object.entries(item).filter(
      ([k, v]) => !exclude.includes(k) && v !== undefined && v !== null && v !== ""
    )
  );
  if (rest.length === 0) return null;
  return (
    <dl className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
      {rest.map(([k, v]) => (
        <div key={k} className="flex flex-wrap items-baseline gap-1.5">
          <dt className="text-[11px] font-bold tracking-wide text-muted-foreground/80 uppercase">
            {fieldLabel(k)}
          </dt>
          <dd className="text-[13px] font-semibold text-foreground">
            <RenderValue fieldKey={k} value={v} depth={1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 목표 배열(annual_goals/goals) — 영역 배지 + 목표 서술 + (있으면) 달성률 진행 막대 카드.
 * 표로는 서술형 본문과 진행률을 함께 보여주기 어려워 ScoreCards 대신 별도 카드를 쓴다
 * (2026-07-19 피드백 — "관련 항목 성격에 맞춰 표/그래프를 섞어 쓰라"). */
function GoalCards({ items }: { items: Record<string, unknown>[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const area = typeof item.area === "string" ? item.area : undefined;
        const goalText =
          (typeof item.goal === "string" && item.goal) ||
          (typeof item.long_term === "string" && item.long_term) ||
          undefined;
        const shortTermText = typeof item.short_term === "string" ? item.short_term : undefined;
        const rate =
          typeof item.achievement_rate === "number"
            ? item.achievement_rate
            : typeof item.target_score === "number"
              ? item.target_score
              : undefined;
        return (
          <div key={i} className="rounded-(--br-md) border border-border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {area && (
                  <p className="text-[11px] font-bold tracking-wide text-primary-700 uppercase">
                    {formatPrimitive("area", area)}
                  </p>
                )}
                {goalText && (
                  <p className="mt-1 text-[15px] font-semibold text-foreground">{goalText}</p>
                )}
              </div>
              {rate !== undefined && (
                <div className="shrink-0 text-right">
                  <p className="text-xl font-extrabold text-primary-700">
                    {rate}
                    <span className="text-xs font-semibold text-muted-foreground">%</span>
                  </p>
                </div>
              )}
            </div>
            {rate !== undefined && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary-600"
                  style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                />
              </div>
            )}
            {shortTermText && (
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                단기목표: {shortTermText}
              </p>
            )}
            <GoalMetaFields
              item={item}
              exclude={["area", "goal", "long_term", "short_term", "achievement_rate", "target_score"]}
            />
          </div>
        );
      })}
    </div>
  );
}

/** status 값의 시각적 강조 톤 — 진행중/이용중 계열은 초록, 예정/일시중지는 주황, 완료는 파랑,
 * 종료는 중립. 알려지지 않은 값은 중립으로 안전하게 처리한다. */
const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ongoing: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  planned: "bg-amber-50 text-amber-700 ring-amber-600/20",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20",
  completed: "bg-primary-50 text-primary-700 ring-primary-600/20",
  ended: "bg-muted text-muted-foreground ring-border",
};

function StatusChip({ value }: { value: string }) {
  const tone = STATUS_TONE[value] ?? "bg-muted text-muted-foreground ring-border";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ring-1 ${tone}`}>
      {formatPrimitive("status", value)}
    </span>
  );
}

/** 균일하고 짧은 객체 배열(지원서비스·훈련이력·현장실습 이력 등) — 행×열 표로 비교하기 좋다
 * (2026-07-19 피드백). 열 순서는 FIELD_ORDER를 재사용, status 칸만 색상 칩으로 강조한다. */
function ObjectTable({ items }: { items: Record<string, unknown>[] }) {
  const keys = sortEntries(
    Array.from(new Set(items.flatMap((it) => Object.keys(it)))).map((k) => [k, undefined])
  ).map(([k]) => k);
  return (
    <div className="overflow-x-auto rounded-(--br-md) border border-border">
      <table className="w-full min-w-[480px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {keys.map((k) => (
              <th
                key={k}
                className="px-3 py-2 text-left text-[11px] font-bold tracking-wide whitespace-nowrap text-muted-foreground/80 uppercase"
              >
                {fieldLabel(k)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 even:bg-muted/20">
              {keys.map((k) => (
                <td key={k} className="px-3 py-2 align-top font-semibold text-foreground">
                  {k === "status" && typeof item[k] === "string" ? (
                    <StatusChip value={item[k] as string} />
                  ) : (
                    compactText(k, item[k])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 짧은 필드들은 2열 표처럼, 긴 필드들은 전체 폭 단락처럼 — 한 섹션 안에서 함께 배치한다. */
function SectionFields({ entries }: { entries: [string, unknown][] }) {
  const compact = entries.filter(([k, v]) => isCompactValue(k, v));
  const rich = entries.filter(([k, v]) => !isCompactValue(k, v));
  return (
    <>
      {compact.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {compact.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-bold tracking-wide text-muted-foreground/80 uppercase">
                {fieldLabel(k)}
              </dt>
              <dd className="mt-1 text-[15px] font-semibold text-foreground">
                <RenderValue fieldKey={k} value={v} depth={0} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {rich.length > 0 && (
        <dl className={compact.length > 0 ? "mt-4 flex flex-col gap-4" : "flex flex-col gap-4"}>
          {rich.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-bold tracking-wide text-muted-foreground/80 uppercase">
                {fieldLabel(k)}
              </dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed font-semibold text-foreground">
                <RenderValue fieldKey={k} value={v} depth={0} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

/** 최상위 문서 레이아웃 — 의미 단위 섹션(개요/세부내용/측정평가/일정/담당자/메모)으로 나눠
 * 렌더한다. 한 화면 아래로 계속 이어지는 평면 목록 대신, 일반 보고서 서식처럼 소제목으로
 * 덩어리를 구분한다. */
function DocumentBody({ obj }: { obj: Record<string, unknown> }) {
  const sorted = sortEntries(Object.entries(obj));
  const sections = SECTION_GROUPS.map((g) => ({
    title: g.title,
    entries: sorted.filter(([k]) => g.priorities.includes(fieldOrder(k))),
  })).filter((s) => s.entries.length > 0);

  if (sections.length === 0) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section, i) => (
        <section
          key={section.title}
          className={i < sections.length - 1 ? "border-b border-border/60 pb-6" : undefined}
        >
          <h3 className="mb-3 text-[13px] font-bold tracking-wide text-primary-700">{section.title}</h3>
          <SectionFields entries={section.entries} />
        </section>
      ))}
    </div>
  );
}

/** G-20 상세 우측 패널 "원본 기록 내용" 본문. content가 객체가 아니면 안내만 표시한다. */
export function RecordContentView({ content }: { content: unknown }) {
  if (!isPlainObject(content)) {
    return <p className="text-body text-muted-foreground">표시할 내용이 없습니다.</p>;
  }
  return <DocumentBody obj={content} />;
}
