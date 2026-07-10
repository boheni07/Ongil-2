import type { SelfExpressionInput, SupportJournalInput } from "@ongil/validation";

/**
 * 화면 표시용 아이콘·라벨 ↔ 스키마 enum 매핑.
 * 원문: prototypes/web/web-person.html(자기표현), web-supporter.html(일지).
 * enum 값은 @ongil/validation 스키마와 1:1 대응(웹과 동일 DB 계약).
 */

export interface Choice<T extends string> {
  value: T;
  emoji: string;
  label: string;
}

// ── P-02 자기표현 ──────────────────────────────────────────
export const MOOD_CHOICES: Choice<SelfExpressionInput["mood"]>[] = [
  { value: "good", emoji: "😊", label: "좋아요" },
  { value: "neutral", emoji: "😐", label: "보통이에요" },
  { value: "sad", emoji: "😢", label: "슬퍼요" },
  { value: "angry", emoji: "😡", label: "화났어요" },
];

export const MEAL_CHOICES: Choice<SelfExpressionInput["meal"]>[] = [
  { value: "full", emoji: "🍚", label: "잘 먹었어요" },
  { value: "partial", emoji: "😐", label: "조금 먹었어요" },
  { value: "none", emoji: "❌", label: "못 먹었어요" },
];

export const ACTIVITY_CHOICES: Choice<NonNullable<SelfExpressionInput["activities"]>[number]>[] = [
  { value: "exercise", emoji: "🏃", label: "운동" },
  { value: "study", emoji: "📚", label: "공부" },
  { value: "craft", emoji: "🎨", label: "만들기" },
  { value: "social", emoji: "👫", label: "친구 만남" },
];

export const HEALTH_CHOICES: Choice<SelfExpressionInput["health"]>[] = [
  { value: "good", emoji: "💪", label: "건강해요" },
  { value: "sick", emoji: "🤧", label: "감기 기운" },
  { value: "tired", emoji: "😴", label: "피곤해요" },
];

// ── S-12 활동지원 일지 ─────────────────────────────────────
/** 활동 카테고리(복수 선택). category는 supportJournalSchema activities[].category로 저장. */
export const JOURNAL_CATEGORIES: { value: string; emoji: string }[] = [
  { value: "신변처리", emoji: "🚿" },
  { value: "이동지원", emoji: "🚶" },
  { value: "식사보조", emoji: "🍚" },
  { value: "가사지원", emoji: "🧹" },
  { value: "병원동행", emoji: "🏥" },
  { value: "의사소통", emoji: "💬" },
];

export const JOURNAL_MEAL_CHOICES: Choice<SupportJournalInput["meal_status"]>[] = [
  { value: "full", emoji: "😋", label: "잘 먹음" },
  { value: "partial", emoji: "😐", label: "조금" },
  { value: "none", emoji: "❌", label: "못 먹음" },
];

export const JOURNAL_HEALTH_CHOICES: Choice<SupportJournalInput["health_status"]>[] = [
  { value: "good", emoji: "💪", label: "양호" },
  { value: "sick", emoji: "🤧", label: "감기 기운" },
  { value: "tired", emoji: "😴", label: "피곤함" },
];

/** 카테고리 emoji 조회(상세/요약 표시용) */
export function categoryEmoji(category: string): string {
  return JOURNAL_CATEGORIES.find((c) => c.value === category)?.emoji ?? "•";
}
