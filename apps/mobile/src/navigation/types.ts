import type { Role } from "@ongil/validation";

/**
 * 미로그인 상태 Auth Stack 파라미터.
 * 회원가입 위저드(RoleSelect→Profile→Consent→VerifyEmail)는 invite 토큰과
 * 단계별 입력값을 파라미터로 이어 전달한다(웹의 withInvite 쿼리스트링과 동일 개념).
 */
export type AuthStackParamList = {
  Login: undefined;
  RoleSelect: { invite?: string } | undefined;
  Profile: { role: Role; invite?: string };
  Consent: { role: Role; email: string; invite?: string };
  VerifyEmail: { email: string; marketingAgreed: boolean; invite?: string };
  InviteAccept: { token: string };
  ResetPassword: undefined;
  Terms: undefined;
  Privacy: undefined;
};
