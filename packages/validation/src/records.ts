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
 */
export const supportJournalSchema = z
  .object({
    service_date: z.string().regex(dateRegex, "서비스 일자는 YYYY-MM-DD 형식이어야 합니다."),
    start_time: z.string().regex(timeRegex, "시작 시간은 HH:MM 형식이어야 합니다."),
    end_time: z.string().regex(timeRegex, "종료 시간은 HH:MM 형식이어야 합니다."),
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
    .object({ goal: z.string(), steps: z.array(z.string()).default([]) })
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

/** record_type → 목록/상세 표시용 한글 라벨(docs/05-erd.md §3). */
export const RECORD_TYPE_LABEL: Record<string, string> = {
  "GEN-001": "보호자 기록",
  "SELF-001": "자기표현",
  "DAI-002": "활동지원 일지",
  "EDU-001": "IEP",
  "EDU-002": "관찰기록",
  "MED-005": "치료계획서",
  "MED-006": "회기 일지",
  "MED-007": "평가보고서",
  "WEL-004": "ISP",
  "WEL-005": "서비스 이용계획",
  "TRA-001": "전환계획",
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
