import { z } from "zod";

/**
 * handover_notes(인계인수) 검증 스키마 — S-21 인계인수 작성 / S-20 목록.
 * docs/04-workflow.md Flow-S-02, docs/01-prd.md F-S-02, docs/05-erd.md §2 handover_notes.
 * 웹(Server Action)·모바일(Supabase 직접 호출)이 동일하게 import해 DB 계약을 공유한다.
 *
 * priority 값 집합은 HandoverPriority enum(high/normal/low)과 1:1 대응한다(schema.prisma §enum).
 * person_id는 서버 액션 인자로 별도 받으므로(journal 패턴) 이 스키마에 포함하지 않는다.
 */

/** 인계인수 중요도 — HandoverPriority enum(§schema.prisma)과 1:1. 기본 normal. */
export const handoverPrioritySchema = z.enum(["high", "normal", "low"]);
export type HandoverPriority = z.infer<typeof handoverPrioritySchema>;

/** S-21 인계인수 작성 폼 입력. content 필수, priority 기본 normal, toUserId 대상 지원사. */
export const handoverNoteSchema = z.object({
  toUserId: z.string().uuid("대상 지원사 정보가 올바르지 않습니다."),
  content: z
    .string()
    .min(1, "인계인수 내용을 입력해주세요.")
    .max(3000, "인계인수 내용은 3000자 이내여야 합니다."),
  priority: handoverPrioritySchema.default("normal"),
});

export type HandoverNoteInput = z.infer<typeof handoverNoteSchema>;
