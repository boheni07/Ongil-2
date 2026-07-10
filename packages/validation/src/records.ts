import { z } from "zod";

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
