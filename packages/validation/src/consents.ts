/**
 * 동의(consents) 유형 분류 — 온보딩 ConsentForm(apps/web/.../auth/ConsentForm.tsx)의
 * 필수/선택 구분을 단일 상수로 승격한 것. G-65/P-23 동의·권리 관리 화면과 서버 액션이
 * "선택 동의만 철회 가능" 등을 판별할 때 이 상수를 신뢰 소스로 재사용한다.
 *
 * 필수: terms(약관) / privacy(개인정보) / sensitive(민감정보) / unique_id(고유식별정보)
 * 선택: marketing(마케팅 수신)
 *
 * ※ ageOver14(만 14세 이상)는 동의 "행"이 아니라 가입 자격 게이트이므로 consent_type 에서 제외한다.
 */
export const REQUIRED_CONSENT_TYPES = [
  "terms",
  "privacy",
  "sensitive",
  "unique_id",
] as const;

export const OPTIONAL_CONSENT_TYPES = ["marketing"] as const;

export type RequiredConsentType = (typeof REQUIRED_CONSENT_TYPES)[number];
export type OptionalConsentType = (typeof OPTIONAL_CONSENT_TYPES)[number];
export type ConsentType = RequiredConsentType | OptionalConsentType;

export function isRequiredConsent(type: string): type is RequiredConsentType {
  return (REQUIRED_CONSENT_TYPES as readonly string[]).includes(type);
}

export function isOptionalConsent(type: string): type is OptionalConsentType {
  return (OPTIONAL_CONSENT_TYPES as readonly string[]).includes(type);
}
