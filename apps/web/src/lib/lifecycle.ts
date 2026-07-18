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
 * 생애주기 5단계 — docs/07-lifecycle-record-permission-proposal.md v0.2(2026-07-17 채택).
 * 만 0~5세 영유아기 · 6~12세 아동기 · 13~18세 청소년 전환기 · 19~64세 성인기 · 65세+ 노년기.
 * 성년 경계는 기존 18세에서 19세로 상향(민법상 성년 기준 정합). at을 주면 그 시점(예: 기록 작성일)의
 * 단계를 계산한다(기본: 오늘).
 */
export function computeLifeStage(birthDate: string, at: Date = new Date()): LifeStage {
  const age = computeAge(birthDate, at);
  if (age < 6) return "infant";
  if (age < 13) return "child";
  if (age < 19) return "youth_transition";
  if (age < 65) return "adult";
  return "senior";
}

/** 확인(Confirmation) 주체가 "본인"인 단계인지 — 성인기·노년기(만 19세 이상). */
export function isSelfConfirmingStage(stage: LifeStage): boolean {
  return stage === "adult" || stage === "senior";
}

/** 전환계획·전환 섹션이 아직 잠겨 있는 단계인지 — 영유아기·아동기(만 12세 이하). */
export function isPreTransitionStage(stage: LifeStage): boolean {
  return stage === "infant" || stage === "child";
}

/**
 * 개별화전환계획(EDU-005, 학교 ITP) 활성 단계인지 — 청소년 전환기(만 13~18세)만.
 * TRA-001(사회복지사, 청소년기부터 성인기까지 이어지는 "실행" 로드맵)과 달리 EDU-005는
 * 학교 재학 기간에만 유효한 문서라 청소년기 하나로 활성 구간이 좁다(docs/08 안건2-2).
 */
export function isItpActiveStage(stage: LifeStage): boolean {
  return stage === "youth_transition";
}
