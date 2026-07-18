import { z } from "zod";
import { roleSchema } from "./roles";

/** F-AUTH-01 이메일+비밀번호 로그인 (A-02) */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────────────────
// Flow-0 신규 회원가입 (A-03 → A-04 → A-08 → A-05) 단계별 스키마
// ─────────────────────────────────────────────────────────

/** A-03 역할 선택 — 6역할 중 1개 */
export const roleSelectSchema = z.object({
  role: roleSchema,
});

export type RoleSelectInput = z.infer<typeof roleSelectSchema>;

/** 대한민국 휴대폰 형식: 010-0000-0000 */
const phoneRegex = /^010-\d{4}-\d{4}$/;

/** A-04 기본 정보 — 이름/이메일/비밀번호(+확인)/휴대폰 */
export const profileSchema = z
  .object({
    fullName: z.string().min(1, "이름을 입력해주세요."),
    email: z.string().email("올바른 이메일을 입력해주세요."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    passwordConfirm: z.string().min(8),
    phone: z.string().regex(phoneRegex, "휴대폰 번호는 010-0000-0000 형식이어야 합니다."),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * A-08 동의 수집 — PIPA §22 필수/선택 분리 + §23 민감정보 별도.
 * ageOver14는 만 14세 이상 가입 게이트로만 사용하며 consents 테이블에 저장하지 않는다
 * (consent_type enum에 대응 값이 없음).
 * termsAgreed/privacyAgreed/sensitiveAgreed는 필수, marketingAgreed만 선택.
 */
export const consentSchema = z.object({
  ageOver14: z.literal(true),
  termsAgreed: z.literal(true),
  privacyAgreed: z.literal(true),
  sensitiveAgreed: z.literal(true),
  marketingAgreed: z.boolean().default(false),
});

export type ConsentInput = z.infer<typeof consentSchema>;

/** A-05 이메일 OTP 인증 — Supabase verifyOtp(type:'email')용 6자리 코드 */
export const otpVerifySchema = z.object({
  email: z.string().email(),
  token: z.string().length(6, "인증 코드는 6자리입니다."),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

/**
 * 웹 전용 — 위 4단계(A-03/A-04/A-08)를 한 화면으로 합친 통합 회원가입 폼(2026-07-18,
 * 사용자 피드백: "회원가입도 단계별 진행이 아니라 한 화면에서 처리되면 좋겠다").
 * A-05(이메일 OTP 인증)만은 Supabase의 이메일 확인 자체가 비동기 왕복(메일 확인 후 코드 입력)이라
 * 한 화면에 합칠 수 없어 별도 단계로 남는다. 모바일은 여전히 기존 4단계 위저드
 * (roleSelectSchema/profileSchema/consentSchema)를 그대로 쓴다 — 이번 변경은 웹 전용이다.
 */
export const signupFormSchema = z
  .object({
    role: roleSchema,
    fullName: z.string().min(1, "이름을 입력해주세요."),
    email: z.string().email("올바른 이메일을 입력해주세요."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    passwordConfirm: z.string().min(8),
    phone: z.string().regex(phoneRegex, "휴대폰 번호는 010-0000-0000 형식이어야 합니다."),
    ageOver14: z.literal(true),
    termsAgreed: z.literal(true),
    privacyAgreed: z.literal(true),
    sensitiveAgreed: z.literal(true),
    marketingAgreed: z.boolean().default(false),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type SignupFormInput = z.infer<typeof signupFormSchema>;

// ─────────────────────────────────────────────────────────
// A-07 비밀번호 재설정
// ─────────────────────────────────────────────────────────

/** A-07 1단계 — 재설정 링크 발송 요청 */
export const resetRequestSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요."),
});

export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

/** A-07 2단계 — 재설정 링크 클릭 후 새 비밀번호 설정 */
export const resetConfirmSchema = z
  .object({
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
    passwordConfirm: z.string().min(8),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type ResetConfirmInput = z.infer<typeof resetConfirmSchema>;

// ─────────────────────────────────────────────────────────
// Flow-1 이해관계자 초대 수락 (A-06)
// ─────────────────────────────────────────────────────────

/** A-06 초대 수락 — body는 토큰뿐, 나머지는 서버에서 invitations 조회 */
export const inviteAcceptSchema = z.object({
  token: z.string().uuid("올바르지 않은 초대 링크입니다."),
});

export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;
