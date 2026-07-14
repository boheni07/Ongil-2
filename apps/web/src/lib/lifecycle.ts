import type { LifeStage } from "@/components/lifecycle/StageBadge";

/** 만 나이 계산 (birthDate: YYYY-MM-DD). at을 주면 그 시점 기준 나이(기본: 오늘). */
export function computeAge(birthDate: string, at: Date = new Date()): number {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  let age = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age -= 1;
  return Math.max(0, age);
}

/**
 * 생애주기 3단계 — docs/05-erd.md §2-2-1 / StageBadge 설명 문구 기준.
 * 만 14세 미만 아동기 · 14~17세 청소년 전환기 · 18세 이상 성년기.
 * at을 주면 그 시점(예: 기록 작성일)의 단계를 계산한다(기본: 오늘).
 */
export function computeLifeStage(birthDate: string, at: Date = new Date()): LifeStage {
  const age = computeAge(birthDate, at);
  if (age < 14) return "child";
  if (age < 18) return "youth_transition";
  return "adult";
}
