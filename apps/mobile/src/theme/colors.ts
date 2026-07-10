/**
 * 온길 디자인 토큰 (RN). 원문: docs/03-uiux.md §2~§5.
 * 도메인 색상은 플랫폼 공용 SSOT(@ongil/shared DOMAIN_COLORS)를 재사용한다.
 */
export { DOMAIN_COLORS } from "@ongil/shared";
export type { DomainKey } from "@ongil/shared";

/** Primary — Deep Green (§2-1) */
export const PRIMARY = {
  50: "#F0FDF9",
  100: "#E1F5EE",
  400: "#5DCAA5",
  600: "#1D9E75",
  700: "#0F6E56",
  800: "#065F46",
  900: "#064E3B",
} as const;

/** Accent (§2-2) */
export const ACCENT = {
  amber: "#FAC775",
  coral: "#F5C4B3",
  stone: "#444441",
  pebble: "#B4B2A9",
} as const;

/** 중립/표면 색상 */
export const NEUTRAL = {
  bg: "#FFFFFF",
  surface: "#F7F8F7",
  border: "#E2E5E1",
  text: "#1A1C1A",
  textMuted: "#5B605B",
  danger: "#BF3030",
  dangerBg: "#FEF0F0",
} as const;

/** 타이포 (§3) */
export const FONT = {
  h1: 32,
  h2: 24,
  h3: 18,
  body: 14,
  caption: 12,
  label: 12,
} as const;

/** 레이아웃 (§4) */
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** 최소 터치 타겟 (§5, WCAG 2.1) */
export const TOUCH_MIN = 44;
