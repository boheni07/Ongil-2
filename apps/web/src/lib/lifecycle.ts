import type { LifeStage } from "@/components/lifecycle/StageBadge";

/** 만 나이 계산 (birthDate: YYYY-MM-DD) */
export function computeAge(birthDate: string): number {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return Math.max(0, age);
}

/**
 * 생애주기 3단계 — docs/05-erd.md §2-2-1 / StageBadge 설명 문구 기준.
 * 만 14세 미만 아동기 · 14~17세 청소년 전환기 · 18세 이상 성년기.
 */
export function computeLifeStage(birthDate: string): LifeStage {
  const age = computeAge(birthDate);
  if (age < 14) return "child";
  if (age < 18) return "youth_transition";
  return "adult";
}
