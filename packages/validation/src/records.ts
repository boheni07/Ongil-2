import { z } from "zod";
import { domainKeySchema } from "./permissions";

/**
 * records 도메인 검증 스키마 — docs/05-erd.md §3 record_type별 content JSONB.
 * 웹(Server Action)·모바일(Supabase 직접 호출)이 동일하게 import해 DB 계약을 공유한다.
 * content JSONB 구조는 §3 스키마와 1:1 대응한다(키 이름을 임의로 바꾸지 말 것).
 */

/** YYYY-MM-DD */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
/** HH:MM (00:00~23:59) */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ─────────────────────────────────────────────────────────
// SELF-001 — 당사자 자기표현 (P1-3, docs/05-erd.md §3, Flow-P-01)
// ─────────────────────────────────────────────────────────

export const selfExpressionSchema = z.object({
  mood: z.enum(["good", "neutral", "sad", "angry"]),
  meal: z.enum(["full", "partial", "none"]),
  meal_photo_url: z.string().url().optional(),
  activities: z.array(z.enum(["exercise", "study", "craft", "social"])).default([]),
  health: z.enum(["good", "sick", "tired"]),
  memo: z.string().max(1000).optional(),
  voice_url: z.string().url().optional(),
});

export type SelfExpressionInput = z.infer<typeof selfExpressionSchema>;

/**
 * P1-3 "내 프로필 만들기" — person 역할로 셀프 가입한 사용자가 P-01 최초 진입 시
 * persons 행이 없으면 최소 정보로 자기 자신의 persons 행을 생성한다.
 * (A-04 기본정보 가입 단계에서 birth_date를 받지 않아 auth 트리거가 persons를 만들 수 없다.)
 */
export const personProfileSchema = z.object({
  fullName: z.string().min(1, "이름을 입력해주세요."),
  birthDate: z
    .string()
    .regex(dateRegex, "생년월일은 YYYY-MM-DD 형식이어야 합니다.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "올바른 날짜가 아닙니다.")
    .refine((v) => new Date(v) <= new Date(), "생년월일은 미래일 수 없습니다."),
  gender: z.enum(["M", "F", "other"]).optional(),
});

export type PersonProfileInput = z.infer<typeof personProfileSchema>;

// ─────────────────────────────────────────────────────────
// DAI-002 — 활동지원 일지 (P1-4, docs/05-erd.md §3, Flow-S-01)
// ─────────────────────────────────────────────────────────

/** 활동 항목: 카테고리 + 소요(분) */
export const journalActivitySchema = z.object({
  category: z.string().min(1, "활동 항목을 입력해주세요."),
  minutes: z.number().int().min(0).max(1440),
});

/**
 * 활동지원 일지 입력 스키마. service_hours는 서버가 start_time/end_time으로 재계산하므로
 * 입력에 포함하지 않는다(F-S-04 — 클라이언트 계산값은 표시용, DB 저장값은 서버 산출).
 *
 * 활동지원 실무는 "일정표(사전계획)"와 "제공기록지(사후실적)"를 구분한다(docs/07 §5 갭④).
 *  - scheduled_hours: 계획(사전 일정) 시간. 사전 일정 없이 실적만 남길 수도 있어 optional.
 *  - service_hours(content 저장 시 서버가 채움): "실적 시간" — start/end로 재계산한 실제 제공 시간.
 * 두 값은 의미가 다르므로 절대 혼용하지 말 것. service_hours 필드명은 이미 저장된 DAI-002
 * 레코드(목업 포함)와의 하위호환을 위해 그대로 유지한다(actual_hours 등으로 개명 금지).
 */
export const supportJournalSchema = z
  .object({
    service_date: z.string().regex(dateRegex, "서비스 일자는 YYYY-MM-DD 형식이어야 합니다."),
    start_time: z.string().regex(timeRegex, "시작 시간은 HH:MM 형식이어야 합니다."),
    end_time: z.string().regex(timeRegex, "종료 시간은 HH:MM 형식이어야 합니다."),
    /** 계획(사전 일정) 시간 — 사전 일정이 없을 수도 있어 optional. 실적(service_hours)과 별개. */
    scheduled_hours: z.number().min(0).max(24).optional(),
    activities: z.array(journalActivitySchema).default([]),
    health_status: z.enum(["good", "sick", "tired"]),
    meal_status: z.enum(["full", "partial", "none"]),
    incidents: z.string().max(2000).optional(),
    handover_note: z.string().max(2000).optional(),
    reference_journal_id: z.string().uuid().optional(),
  })
  .refine((d) => timeToMinutes(d.end_time) > timeToMinutes(d.start_time), {
    message: "종료 시간은 시작 시간보다 늦어야 합니다.",
    path: ["end_time"],
  });

export type SupportJournalInput = z.infer<typeof supportJournalSchema>;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * 서비스 시간(시간 단위) 계산 — end - start. 소수 둘째 자리 반올림.
 * 서버(Server Action)와 모바일이 동일 로직을 쓰도록 순수 함수로 제공한다(F-S-04).
 * start/end는 supportJournalSchema를 통과한 HH:MM만 전달된다고 가정한다.
 */
export function computeServiceHours(startTime: string, endTime: string): number {
  const diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Math.round((diff / 60) * 100) / 100;
}

// ─────────────────────────────────────────────────────────
// GEN-001 — 보호자 범용 기록 (G-21, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/**
 * 보호자가 도메인 제한 없이 직접 작성하는 범용 기록 타입.
 * 전문가가 만든 구조화 기록(EDU-001/WEL-004 등)과 달리 content가 {title, body}로 단순하다.
 * 보호자의 기존 구조화 기록 "수정"은 이 타입으로 저장하지 않고 원본 content에
 * guardianNote 서브키를 비파괴적으로 병합한다(구조화 필드 유실 방지, actions.ts 참고).
 */
export const GUARDIAN_RECORD_TYPE = "GEN-001";

export const guardianRecordSchema = z.object({
  domain: domainKeySchema,
  title: z.string().min(1, "제목을 입력해주세요.").max(200, "제목은 200자 이내여야 합니다."),
  body: z.string().min(1, "내용을 입력해주세요.").max(5000, "내용은 5000자 이내여야 합니다."),
});

export type GuardianRecordInput = z.infer<typeof guardianRecordSchema>;

/** 구조화 기록에 병합되는 보호자 메모 서브키(content.guardianNote) 형태. */
export interface GuardianNote {
  title: string;
  body: string;
  editedAt: string;
}

// ─────────────────────────────────────────────────────────
// EDU-001 — IEP 개별화교육계획 (P2-1 T-13/T-14, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/** 단기(분기) 목표 — 목표+기간+평가방법. content JSONB는 snake_case(§3 EDU-001). */
export const iepShortTermGoalSchema = z.object({
  goal: z.string(),
  period: z.string(),
  evaluation: z.string(),
});

/**
 * 연간 목표. area/goal/short_term_goals는 T-13 작성 시 채운다.
 * achievement_rate·evaluation_note는 §3 EDU-001 원안에 없던 선택 확장 필드로,
 * 작성 시엔 없다가 T-14 인라인 점검(updateIepGoal)에서 채운다(그래서 optional).
 * T-01 카드의 달성률 평균은 채워진 achievement_rate만 집계한다.
 */
export const iepAnnualGoalSchema = z.object({
  area: z.string(),
  goal: z.string(),
  short_term_goals: z.array(iepShortTermGoalSchema).default([]),
  achievement_rate: z.number().int().min(0).max(100).optional(),
  evaluation_note: z.string().max(2000).optional(),
});

/**
 * IEP content(EDU-001). content JSONB 키는 §3 EDU-001과 1:1(snake_case).
 * 기존 SELF-001/DAI-002가 snake_case이므로 일관성을 위해 IEP도 snake_case로 저장한다.
 * transition_plan은 만 14세+(life_stage != 'child')에서만 프론트가 전송한다(없으면 저장 생략).
 */
export const iepSchema = z.object({
  school: z.string().min(1, "학교명을 입력해주세요."),
  academic_year: z.string().min(1, "학년도를 입력해주세요."),
  meeting_date: z.string().regex(dateRegex, "IEP 회의 날짜는 YYYY-MM-DD 형식이어야 합니다."),
  participants: z.array(z.string()).default([]),
  current_levels: z.object({
    korean: z.string(),
    math: z.string(),
    social: z.string(),
    communication: z.string(),
    self_care: z.string(),
  }),
  annual_goals: z.array(iepAnnualGoalSchema).min(1, "연간 목표를 1개 이상 입력해주세요."),
  support_services: z
    .array(
      z.object({
        service: z.string(),
        provider: z.string(),
        frequency: z.string(),
      })
    )
    .default([]),
  transition_plan: z
    .object({
      // 전환 목표 영역(2026-07-19, 프로토타입 web-teacher.html T-13 대조로 보강 — 기존
      // goal/steps 2필드만 있어 실제 서식에 없던 목표영역·연계기관을 추가). optional인 이유는
      // 이 필드 추가 이전에 저장된 기존 IEP 레코드와의 하위호환.
      goal_area: z.enum(["career", "independent_living", "community", "further_education"]).optional(),
      goal: z.string(),
      steps: z.array(z.string()).default([]),
      linked_agencies: z.string().optional(),
    })
    .optional(),
});

export type IepInput = z.infer<typeof iepSchema>;
export type IepAnnualGoal = z.infer<typeof iepAnnualGoalSchema>;

/** T-14 인라인 편집 — annual_goals[goalIndex]에 얕게 병합할 부분 필드(최소 1개 필수). */
export const iepGoalPatchSchema = z
  .object({
    area: z.string().optional(),
    goal: z.string().optional(),
    short_term_goals: z.array(iepShortTermGoalSchema).optional(),
    achievement_rate: z.number().int().min(0).max(100).optional(),
    evaluation_note: z.string().max(2000).optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: "수정할 내용이 없습니다.",
  });

export type IepGoalPatch = z.infer<typeof iepGoalPatchSchema>;

// ─────────────────────────────────────────────────────────
// EDU-002 — 관찰기록 (P2-1 T-16, docs/05-erd.md §3, 프로토타입 web-teacher.html T-16)
// ─────────────────────────────────────────────────────────

/**
 * 관찰기록 태그 카탈로그 — 4개 카테고리, 프로토타입 T-16(456~485줄) 그대로.
 * ObsTagSelector가 이 상수를 렌더하고 선택된 태그 문자열들을 tags[]로 전송한다.
 */
export const OBSERVATION_TAG_CATALOG: Record<string, readonly string[]> = {
  행동: ["착석 유지", "자리 이탈", "과제 집중", "상동행동"],
  언어: ["발화 시도", "AAC 사용", "지시 이해", "반향어"],
  사회성: ["또래 상호작용", "차례 지키기", "협동 활동", "갈등 상황"],
  학습: ["목표 도달", "부분 도움 필요", "읽기", "쓰기"],
};

/**
 * 관찰기록 content(EDU-002). §3에 원안이 없어 프로토타입 T-16을 스키마화한 신설 타입.
 * EDU-001(snake_case)과 달리 camelCase 키를 쓴다 — linkedGoalArea는 T-14 관찰기록 연결의
 * 느슨한 문자열 매칭 키(FK 아님)다. requires_confirmation=false(§4-6 일상 기록).
 */
export const observationSchema = z.object({
  observedAt: z.string(),
  situation: z.string().min(1, "관찰 상황을 입력해주세요."),
  tags: z.array(z.string()).min(1, "관찰 태그를 1개 이상 선택해주세요."),
  note: z
    .string()
    .min(1, "관찰 내용을 입력해주세요.")
    .max(3000, "관찰 내용은 3000자 이내여야 합니다."),
  linkedGoalArea: z.string().optional(),
});

export type ObservationInput = z.infer<typeof observationSchema>;

// ─────────────────────────────────────────────────────────
// EDU-003 — 행동중재계획 BIP (docs/07 §5 갭③, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/**
 * 행동의 기능(§3 EDU-003 behavior_function) — BIP 기능평가(FBA) 관행의 4대 분류.
 * 관심획득(attention)/회피(escape)/감각추구(sensory)/기타(other).
 */
export const behaviorFunctionSchema = z.enum(["attention", "escape", "sensory", "other"]);
export type BehaviorFunction = z.infer<typeof behaviorFunctionSchema>;

/**
 * 기능평가 근거(§3 EDU-003 fba_basis, 2026-07-17 워크숍 안건2-1 병합) — 복수선택.
 * 별도 FBA record_type(EDU-004 후보) 대신, behavior_function 판정에 쓴 근거 자료 유형을
 * BIP 자체에 선택 필드로 흡수했다. 신설 없이 기존 유형 확장으로 갭을 해소한 사례.
 */
export const fbaBasisSchema = z.enum(["observation", "guardian_interview", "teacher_interview", "checklist"]);
export type FbaBasis = z.infer<typeof fbaBasisSchema>;

/**
 * BIP content(EDU-003). content JSONB 키는 §3 EDU-003과 1:1(snake_case).
 * 특수교사(teacher)가 작성하는 공식 지원계획 문서라 requires_confirmation=true(§4-6① —
 * IEP·ISP·치료계획서와 동일 분류). 제출(is_draft=false) 시 trg_assign_confirmer가 확인 주체를
 * 자동 지정한다(성년=본인, 미성년=주보호자). 스키마 스타일은 동급 공식 문서 EDU-001(IEP)의
 * snake_case를 따른다. crisis_procedure만 optional(위기대응 절차가 불필요한 경도 사례도 있음).
 */
export const bipSchema = z.object({
  target_behavior: z
    .string()
    .min(1, "중재 대상 행동을 입력해주세요.")
    .max(2000, "중재 대상 행동은 2000자 이내여야 합니다."),
  behavior_function: behaviorFunctionSchema,
  fba_basis: z.array(fbaBasisSchema).optional(),
  antecedent_strategies: z
    .string()
    .min(1, "선행사건 중재 전략을 입력해주세요.")
    .max(3000, "선행사건 중재 전략은 3000자 이내여야 합니다."),
  replacement_behavior: z
    .string()
    .min(1, "대체행동을 입력해주세요.")
    .max(2000, "대체행동은 2000자 이내여야 합니다."),
  reinforcement_plan: z
    .string()
    .min(1, "강화 계획을 입력해주세요.")
    .max(3000, "강화 계획은 3000자 이내여야 합니다."),
  crisis_procedure: z.string().max(3000).optional(),
  review_date: z.string().regex(dateRegex, "재검토 예정일은 YYYY-MM-DD 형식이어야 합니다."),
});

export type BipInput = z.infer<typeof bipSchema>;

// ─────────────────────────────────────────────────────────
// EDU-005 — 개별화전환계획 ITP (특수교사, docs/08-record-taxonomy-workshop.md 안건2-2 신설)
// ─────────────────────────────────────────────────────────

/** 현장실습·직업체험 이력 항목(§3 EDU-005 work_experience_log[]). */
export const workExperienceEntrySchema = z.object({
  activity: z.string().min(1, "실습/체험 활동명을 입력해주세요."),
  period: z.object({ start: z.string(), end: z.string() }),
  note: z.string().max(1000).optional(),
});
export type WorkExperienceEntry = z.infer<typeof workExperienceEntrySchema>;

/**
 * 개별화전환계획(ITP) content(EDU-005). content JSONB 키는 snake_case — 동급 공식 문서
 * EDU-001(IEP)·EDU-003(BIP)과 일관된 스타일.
 * 특수교사가 작성하는 학교 단위 전환교육계획(진로·직업 탐색, 현장실습 이력). TRA-001(사회복지사,
 * 성인기 "실행" 로드맵)과는 별개 레코드 — person_id로만 느슨하게 연결한다(FK 없음, TRA-001↔EDU-001.
 * transition_plan과 동일 관행). 활성 단계는 청소년 전환기(만 13~18세)만 — `isItpActiveStage`.
 * 공식 지원계획 문서라 requires_confirmation=true(§4-6①) — 제출 시 trg_assign_confirmer가
 * 확인 주체(성년=본인, 미성년=주보호자)를 자동 지정한다. PM 합의에 따라 최소 스키마로 시작한다
 * (docs/08 안건2-2 "범위 최소화").
 */
export const itpSchema = z.object({
  career_interest_areas: z
    .array(z.string().min(1))
    .min(1, "진로 흥미영역을 1개 이상 입력해주세요."),
  work_experience_log: z.array(workExperienceEntrySchema).default([]),
  next_step_note: z.string().max(2000).optional(),
  next_review_date: z
    .string()
    .regex(dateRegex, "다음 검토일은 YYYY-MM-DD 형식이어야 합니다."),
});

export type ItpInput = z.infer<typeof itpSchema>;

// ─────────────────────────────────────────────────────────
// MED-005 — 치료계획서 (P2-3 TH-13/TH-14, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/** 치료 영역 4종(§3 MED-005 goals[].area / MED-006 domain_scores 키와 1:1). */
export const therapyAreaSchema = z.enum(["physical", "language", "cognitive", "social"]);
export type TherapyArea = z.infer<typeof therapyAreaSchema>;

/**
 * 치료 목표 영역(§3 MED-005 goals[]). area는 4개 치료 영역 enum이라 MED-006 domain_scores와
 * 정확히 매핑된다(IEP/ISP의 자유문자열 area와 다름 — TH-14 달성도 표시가 영역별로 이뤄지기 때문).
 * target_score는 §3에서 optional(평가/회기 domain_scores 비교 기준).
 */
export const therapyPlanGoalSchema = z.object({
  area: therapyAreaSchema,
  long_term: z.string(),
  short_term: z.string(),
  target_score: z.number().int().min(0).max(100).optional(),
});

/**
 * 치료계획서 content(MED-005). content JSONB 키는 §3 MED-005와 1:1(snake_case).
 * 치료계획서는 IEP/ISP와 동급 공식 문서라 requires_confirmation=true(§4-6 표).
 */
export const therapyPlanSchema = z.object({
  plan_period: z.object({
    start: z.string().regex(dateRegex, "치료 시작일은 YYYY-MM-DD 형식이어야 합니다."),
    end: z.string().regex(dateRegex, "치료 종료일은 YYYY-MM-DD 형식이어야 합니다."),
  }),
  diagnosis: z.string().min(1, "진단명을 입력해주세요."),
  therapy_type: z.enum(["physical", "occupational", "speech", "psychological", "other"]),
  goals: z.array(therapyPlanGoalSchema).min(1, "치료 목표를 1개 이상 입력해주세요."),
  session_frequency: z.string().min(1, "회기 빈도를 입력해주세요."),
  responsible_therapist: z.string().min(1, "담당 치료사를 입력해주세요."),
  precautions: z.string().max(2000).optional(),
});

export type TherapyPlanInput = z.infer<typeof therapyPlanSchema>;
export type TherapyPlanGoal = z.infer<typeof therapyPlanGoalSchema>;

/** TH-14/TH-15 인라인 편집 — goals[goalIndex]에 얕게 병합할 부분 필드(최소 1개 필수). */
export const therapyPlanGoalPatchSchema = z
  .object({
    area: therapyAreaSchema.optional(),
    long_term: z.string().optional(),
    short_term: z.string().optional(),
    target_score: z.number().int().min(0).max(100).optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: "수정할 내용이 없습니다.",
  });

export type TherapyPlanGoalPatch = z.infer<typeof therapyPlanGoalPatchSchema>;

// ─────────────────────────────────────────────────────────
// MED-006 — 회기 일지 (P2-3 TH-15, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/** 영역별 달성도(§3 MED-006 domain_scores). 4개 치료 영역 각 0~100. */
export const therapyDomainScoresSchema = z.object({
  physical: z.number().int().min(0).max(100),
  language: z.number().int().min(0).max(100),
  cognitive: z.number().int().min(0).max(100),
  social: z.number().int().min(0).max(100),
});

export type TherapyDomainScores = z.infer<typeof therapyDomainScoresSchema>;

/**
 * 회기 일지 content(MED-006). content JSONB 키는 §3 MED-006와 1:1(snake_case).
 * therapy_plan_id는 TH-15 진입 시 getSessionComposeContext가 최근 확정 MED-005를
 * 자동 연결해 채운다(uuid). 회기 일지는 일상 기록이라 requires_confirmation=false(§4-6 표).
 */
export const sessionNoteSchema = z.object({
  session_date: z.string().regex(dateRegex, "회기 일자는 YYYY-MM-DD 형식이어야 합니다."),
  therapy_plan_id: z.string().uuid("연결된 치료계획서 ID가 올바르지 않습니다."),
  session_number: z.number().int().min(1, "회기 차수를 입력해주세요."),
  planned_goals: z.array(z.string()).default([]),
  actual_progress: z.string().min(1, "실제 진행 내용을 입력해주세요."),
  domain_scores: therapyDomainScoresSchema,
  observations: z.string().min(1, "관찰 내용을 입력해주세요."),
  next_session_plan: z.string().max(2000).optional(),
});

export type SessionNoteInput = z.infer<typeof sessionNoteSchema>;

// ─────────────────────────────────────────────────────────
// MED-007 — 평가보고서 (P2-3 TH-17, docs/05-erd.md §3 581-597)
// ─────────────────────────────────────────────────────────

/**
 * 평가 영역별 점수(§3 MED-007 domain_scores). MED-006의 therapyDomainScoresSchema와 달리
 * §3 MED-007은 {domain, score}[] 배열 형태다(고정 키 객체 아님) — 절대 재사용하지 말 것.
 * domain 4종은 MED-005 goals[].area / MED-006 domain_scores 키와 동일 enum이다.
 */
export const evalDomainScoreSchema = z.object({
  domain: therapyAreaSchema,
  score: z.number().int().min(0).max(100),
});

export type EvalDomainScore = z.infer<typeof evalDomainScoreSchema>;

/**
 * 평가보고서 content(MED-007). content JSONB 키는 §3 MED-007과 1:1(snake_case).
 * therapy_plan_id는 TH-17 진입 시 getEvalComposeContext가 최근 확정 MED-005를 자동 연결해 채운다.
 * §4-6 확인 대상 표에 MED-007이 없어 requires_confirmation=false(회기일지와 동급 일상 기록).
 * eval_type(초기/중간/최종)은 같은 therapy_plan_id당 각 1건 가정 — TH-17 3열 비교 뷰의 열 키.
 */
export const evalReportSchema = z.object({
  eval_type: z.enum(["initial", "interim", "final"]),
  eval_date: z.string().regex(dateRegex, "평가 일자는 YYYY-MM-DD 형식이어야 합니다."),
  therapy_plan_id: z.string().uuid("연결된 치료계획서 ID가 올바르지 않습니다."),
  domain_scores: z.array(evalDomainScoreSchema).min(1, "평가 영역 점수를 1개 이상 입력해주세요."),
  summary: z.string().min(1, "종합 평가 요약을 입력해주세요.").max(3000, "요약은 3000자 이내여야 합니다."),
  recommendations: z.string().max(2000).optional(),
});

export type EvalReportInput = z.infer<typeof evalReportSchema>;

// ─────────────────────────────────────────────────────────
// WEL-004 — ISP 개별지원계획 (P2-2 W-13/W-14, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/**
 * 욕구사정 항목(§3 WEL-004 needs[]). W-13 Step2에서 "주요 욕구 영역"(복수 선택 칩) 하나당
 * 한 항목으로 매핑한다 — area=칩 라벨, needs=당사자·가족 욕구 진술(칩 간 공유), barriers는
 * 위저드에 별도 입력이 없어 기본 빈 문자열(프론트가 채우면 저장).
 */
export const ispNeedSchema = z.object({
  area: z.string(),
  needs: z.string(),
  barriers: z.string().default(""),
});

/**
 * 목표 영역(§3 WEL-004 goals[]). area/long_term/short_term/responsible/deadline은 W-13 Step3
 * 작성 시 채운다. achievement_rate는 §3 원안엔 필수지만 IEP(EDU-001)와 동일하게 작성 시엔
 * 없다가 W-14 인라인 점검(updateIspGoal)에서 채우는 운영이라 optional로 둔다 — W-01/W-14
 * 달성률 평균·프로그레스 바는 채워진 값만 집계한다.
 */
export const ispGoalSchema = z.object({
  area: z.string(),
  long_term: z.string(),
  short_term: z.string(),
  responsible: z.string(),
  deadline: z.string(),
  achievement_rate: z.number().int().min(0).max(100).optional(),
});

/**
 * ISP content(WEL-004). content JSONB 키는 §3 WEL-004와 1:1(snake_case).
 * assessment_tool은 §3 원안에 없는 필드지만 W-13 Step2 "사정 도구/근거" 셀렉트 값을 유실
 * 없이 저장하기 위한 단일 옵셔널 확장 필드다(needs[].barriers에 욱여넣지 않기 위함).
 * reassessment_date는 W-14 재사정 D-30 배지 계산의 기준이라 YYYY-MM-DD로 강제한다.
 */
export const ispSchema = z.object({
  service_period: z.object({
    start: z.string().regex(dateRegex, "지원 시작일은 YYYY-MM-DD 형식이어야 합니다."),
    end: z.string().regex(dateRegex, "지원 종료일은 YYYY-MM-DD 형식이어야 합니다."),
  }),
  reassessment_date: z.string().regex(dateRegex, "재사정 예정일은 YYYY-MM-DD 형식이어야 합니다."),
  case_manager: z.string().min(1, "담당자를 입력해주세요."),
  assessment_tool: z.string().optional(),
  needs: z.array(ispNeedSchema).default([]),
  goals: z.array(ispGoalSchema).min(1, "목표를 1개 이상 입력해주세요."),
  services: z
    .array(
      z.object({
        service: z.string(),
        provider: z.string(),
        frequency: z.string(),
        start: z.string(),
      })
    )
    .default([]),
});

export type IspInput = z.infer<typeof ispSchema>;
export type IspGoal = z.infer<typeof ispGoalSchema>;

/** W-14 인라인 편집 — goals[goalIndex]에 얕게 병합할 부분 필드(최소 1개 필수). */
export const ispGoalPatchSchema = z
  .object({
    area: z.string().optional(),
    long_term: z.string().optional(),
    short_term: z.string().optional(),
    responsible: z.string().optional(),
    deadline: z.string().optional(),
    achievement_rate: z.number().int().min(0).max(100).optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: "수정할 내용이 없습니다.",
  });

export type IspGoalPatch = z.infer<typeof ispGoalPatchSchema>;

// ─────────────────────────────────────────────────────────
// WEL-005 — 서비스 이용계획 (P2-2 W-17, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/** 개별 서비스 이용 항목(§3 WEL-005 services[]). W-17 현황표는 이 배열을 평탄화해 렌더한다. */
export const serviceUsageItemSchema = z.object({
  service_name: z.string().min(1, "서비스명을 입력해주세요."),
  provider: z.string(),
  frequency: z.string(),
  start_date: z.string(),
  end_date: z.string().optional(),
  status: z.enum(["active", "paused", "ended"]),
});

/** ISP content(WEL-005). content JSONB 키는 §3 WEL-005와 1:1(snake_case). */
export const serviceUsageSchema = z.object({
  services: z.array(serviceUsageItemSchema).default([]),
  monthly_cost: z.number().optional(),
  funding_source: z.string().optional(),
  case_manager: z.string().min(1, "담당자를 입력해주세요."),
  next_review_date: z.string().regex(dateRegex, "다음 검토일은 YYYY-MM-DD 형식이어야 합니다."),
});

export type ServiceUsageInput = z.infer<typeof serviceUsageSchema>;
export type ServiceUsageItem = z.infer<typeof serviceUsageItemSchema>;

// ─────────────────────────────────────────────────────────
// TRA-001 — 전환계획 (W-16, docs/05-erd.md §3 TRA-001 642-659)
// ─────────────────────────────────────────────────────────

/** 로드맵 4단계 — 탐색→계획→훈련→취업/자립(§3 TRA-001 roadmap_stage). W-16 로드맵 마커 위치. */
export const roadmapStageSchema = z.enum(["exploration", "planning", "training", "employment"]);
export type RoadmapStage = z.infer<typeof roadmapStageSchema>;

/**
 * 훈련 이력 항목(§3 TRA-001 training_records[]). program/provider + 기간 + 진행 상태.
 * period.start/end는 §3 원안이 자유 문자열이라 YYYY-MM-DD를 강제하지 않는다(진행 중 미정 허용).
 */
export const trainingRecordSchema = z.object({
  program: z.string().min(1, "훈련 프로그램명을 입력해주세요."),
  provider: z.string().min(1, "훈련 제공기관을 입력해주세요."),
  period: z.object({ start: z.string(), end: z.string() }),
  status: z.enum(["planned", "ongoing", "completed"]),
});

export type TrainingRecord = z.infer<typeof trainingRecordSchema>;

/**
 * 전환계획 content(TRA-001). content JSONB 키는 §3 TRA-001과 1:1(snake_case).
 * 전환계획은 IEP/ISP와 동급의 공식 문서라 requires_confirmation=true(§4-6 표) — 제출 시
 * trg_assign_confirmer가 확인 주체(성년=본인, 미성년=주보호자)를 자동 지정한다.
 * 만 14세+(life_stage != 'child')에서만 작성한다 — 진입 가드는 프론트·백엔드 양쪽에서 강제.
 */
export const transitionPlanSchema = z.object({
  roadmap_stage: roadmapStageSchema,
  career_goal: z.string().min(1, "희망 진로를 입력해주세요."),
  independent_living_plan: z.string().max(2000).optional(),
  training_records: z.array(trainingRecordSchema).default([]),
  linked_agencies: z.array(z.string()).optional(),
  case_manager: z.string().min(1, "담당자를 입력해주세요."),
  next_review_date: z.string().regex(dateRegex, "다음 검토일은 YYYY-MM-DD 형식이어야 합니다."),
});

export type TransitionPlanInput = z.infer<typeof transitionPlanSchema>;

// ─────────────────────────────────────────────────────────
// LEG-001 — 후견감독보고서 (social_worker, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/** 후견 유형(§3 LEG-001 guardian_type) — 성년/한정/특정/임의후견. */
export const guardianTypeSchema = z.enum(["adult", "limited", "specific", "voluntary"]);
export type GuardianType = z.infer<typeof guardianTypeSchema>;

/**
 * 후견감독보고서 content(LEG-001). content JSONB 키는 §3 LEG-001과 1:1(snake_case).
 * 성년후견인이 정기적으로 법원에 제출하는 후견감독보고서를 플랫폼에 기록한다.
 * 법정·공식 서류라 requires_confirmation=true(§4-6 표) — 제출(is_draft=false) 시
 * trg_assign_confirmer가 확인 주체(성인기·노년기=본인, 그 외=주보호자)를 자동 지정한다.
 * 스키마 스타일은 동급 공식 문서인 WEL-004(ISP)·MED-005(치료계획서)의 snake_case를 따른다
 * (period 객체 + type enum + 담당자 성명 + 서술 요약 + optional 특이사항 + 다음 기한).
 */
/**
 * 보고 구분(§3 LEG-001 report_kind, 2026-07-17 워크숍 안건2-4 병합) — 후견개시 직후 법원에
 * 내는 최초 재산목록보고(initial)와 정기 후견사무보고(periodic)를 하나의 record_type 안에서
 * 구분한다. 별도 record_type(LEG-003 후보) 대신 판별 필드로 흡수해 RLS·권한 프리셋을 그대로
 * 재사용한다. 기본값은 periodic(기존 레코드는 필드 없어도 정기 보고로 간주해 하위호환).
 */
export const legReportKindSchema = z.enum(["initial", "periodic"]);
export type LegReportKind = z.infer<typeof legReportKindSchema>;

export const guardianshipReportSchema = z.object({
  report_kind: legReportKindSchema.default("periodic"),
  report_period: z.object({
    start: z.string().regex(dateRegex, "보고 시작일은 YYYY-MM-DD 형식이어야 합니다."),
    end: z.string().regex(dateRegex, "보고 종료일은 YYYY-MM-DD 형식이어야 합니다."),
  }),
  guardian_type: guardianTypeSchema,
  guardian_name: z.string().min(1, "후견인 성명을 입력해주세요."),
  property_management_summary: z
    .string()
    .min(1, "재산관리 현황을 입력해주세요.")
    .max(3000, "재산관리 현황은 3000자 이내여야 합니다."),
  personal_care_summary: z
    .string()
    .min(1, "신상보호 현황을 입력해주세요.")
    .max(3000, "신상보호 현황은 3000자 이내여야 합니다."),
  incidents: z.string().max(2000).optional(),
  next_report_due: z
    .string()
    .regex(dateRegex, "다음 보고 예정일은 YYYY-MM-DD 형식이어야 합니다."),
});

export type GuardianshipReportInput = z.infer<typeof guardianshipReportSchema>;

// ─────────────────────────────────────────────────────────
// LEG-002 — 권익옹호 상담기록 (social_worker, docs/05-erd.md §3)
// ─────────────────────────────────────────────────────────

/** 상담 유형(§3 LEG-002 issueType) — 인권침해/차별/학대의심/기타. */
export const advocacyIssueTypeSchema = z.enum([
  "rights_violation",
  "discrimination",
  "abuse_suspected",
  "other",
]);
export type AdvocacyIssueType = z.infer<typeof advocacyIssueTypeSchema>;

/**
 * 권익옹호 상담기록 content(LEG-002). 일상 기록이라 requires_confirmation=false(§4-6 —
 * 관찰기록·활동지원일지와 동급). EDU-002(관찰기록) 스타일을 참고해 camelCase 키를 쓴다
 * — EDU-001 등 snake_case 구조화 문서와 달리, 확인 절차가 없는 일상 관찰성 기록의 유일한
 * 선례(EDU-002)와 일관되게 맞춘다. consultedAt은 record_date로도 사용한다.
 */
export const advocacyConsultationSchema = z.object({
  consultedAt: z.string(),
  issueType: advocacyIssueTypeSchema,
  content: z
    .string()
    .min(1, "상담 내용을 입력해주세요.")
    .max(3000, "상담 내용은 3000자 이내여야 합니다."),
  actionTaken: z.string().max(2000).optional(),
  referralAgency: z.string().optional(),
});

export type AdvocacyConsultationInput = z.infer<typeof advocacyConsultationSchema>;

// ─────────────────────────────────────────────────────────
// WEL-006 — 사례회의록 (social_worker, docs/08-record-taxonomy-workshop.md 안건2-3)
// ─────────────────────────────────────────────────────────

/**
 * 사례회의록 content(WEL-006). 일상 기록이라 requires_confirmation=false(§4-6 — 관찰기록·
 * 권익옹호 상담기록과 동급) — ISP(WEL-004) 수립·재사정 시 논의 과정·결정사항을 남기되,
 * 확인 절차로 알림 피로를 키우지 않는다(워크숍 안건2-3). camelCase 키를 써서 확인 절차 없는
 * 일상 기록의 기존 관행(EDU-002·LEG-002)과 맞춘다. 위자드가 아니라 단일 폼으로 빠르게 기록한다.
 */
export const caseConferenceNoteSchema = z.object({
  meetingDate: z.string(),
  participants: z
    .array(z.string().min(1))
    .min(1, "참석자를 1명 이상 입력해주세요."),
  discussion: z
    .string()
    .min(1, "논의 내용을 입력해주세요.")
    .max(3000, "논의 내용은 3000자 이내여야 합니다."),
  decisions: z.string().max(2000).optional(),
});

export type CaseConferenceNoteInput = z.infer<typeof caseConferenceNoteSchema>;

/** record_type → 목록/상세 표시용 한글 라벨(docs/05-erd.md §3). */
export const RECORD_TYPE_LABEL: Record<string, string> = {
  "GEN-001": "보호자 기록",
  "SELF-001": "자기표현",
  "DAI-002": "활동지원 일지",
  "EDU-001": "IEP",
  "EDU-002": "관찰기록",
  "EDU-003": "행동중재계획(BIP)",
  "EDU-005": "개별화전환계획(ITP)",
  "MED-005": "치료계획서",
  "MED-006": "회기 일지",
  "MED-007": "평가보고서",
  "WEL-004": "ISP",
  "WEL-005": "서비스 이용계획",
  "TRA-001": "전환계획",
  "LEG-001": "후견감독보고서",
  "LEG-002": "권익옹호 상담기록",
  "WEL-006": "사례회의록",
};

/**
 * G-20 목록 표시용 제목. GEN-001은 content.title을 그대로 쓰고, 나머지 구조화 기록은
 * record_type 라벨을 쓴다(9종 전부 완벽한 제목 추출은 하지 않는 실용적 처리).
 */
export function recordDisplayTitle(recordType: string, content: unknown): string {
  if (recordType === GUARDIAN_RECORD_TYPE) {
    const c = content as { title?: unknown } | null;
    if (c && typeof c.title === "string" && c.title.trim()) return c.title.trim();
  }
  return RECORD_TYPE_LABEL[recordType] ?? recordType;
}
