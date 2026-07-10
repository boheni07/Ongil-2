import type { Role } from "@ongil/validation";

/**
 * docs/02-ia.md §5 — 역할별 홈 라우팅 규칙.
 * 로그인 직후 및 (auth)/* 접근 시 리다이렉트 대상으로 web/mobile 공통 사용.
 */
export const ROLE_HOME: Record<Role, string> = {
  person: "/home",
  guardian: "/dashboard",
  supporter: "/home",
  teacher: "/home",
  social_worker: "/home",
  therapist: "/home",
};
