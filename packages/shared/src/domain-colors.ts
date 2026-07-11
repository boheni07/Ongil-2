/**
 * 6도메인 색상 SSOT (Single Source of Truth).
 * 원문: docs/03-uiux.md §2-3
 *
 * bg/text는 도메인 배지·칩 배경/텍스트, accent는 카드 보더·강조선에 사용한다.
 * Tailwind 유틸리티(`bg-domain-med-bg` 등)는 `apps/web/src/app/globals.css`의
 * `@theme` 토큰과 이 상수가 동일한 값을 갖도록 유지해야 한다.
 */
export const DOMAIN_COLORS = {
  MED: { bg: "#FEF0F0", text: "#BF3030", accent: "#E04545" },
  EDU: { bg: "#EEF4FD", text: "#2E5FA8", accent: "#4377C0" },
  WEL: { bg: "#EDFAF3", text: "#276B4C", accent: "#3EA673" },
  DAI: { bg: "#FFF5E6", text: "#B56F10", accent: "#E8991E" },
  TRA: { bg: "#F4EFFB", text: "#6A43A8", accent: "#8A5DC6" },
  LEG: { bg: "#EEF2F7", text: "#3E5E7A", accent: "#5A7FA0" },
} as const;

// DomainKey의 SSOT는 @ongil/validation(도메인 값 집합은 DB CHECK 제약과 1:1). 여기서는 재노출만 한다.
export type { DomainKey } from "@ongil/validation";
