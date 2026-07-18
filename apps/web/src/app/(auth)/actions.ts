"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  loginSchema,
  signupFormSchema,
  otpVerifySchema,
  resetRequestSchema,
  resetConfirmSchema,
  inviteAcceptSchema,
} from "@ongil/validation";
import { ROLE_HOME } from "@ongil/shared";
import type { Role } from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** consents.consent_type 중 회원가입 단계에서 수집하는 값(§2-8) */
type ConsentType = "terms" | "privacy" | "sensitive" | "marketing";

/**
 * 인증·온보딩 Server Action 모음 (A-02~A-10, Flow-0 / Flow-1 / A-07).
 * frontend-dev는 이 액션들을 import해 화면 폼에 연결한다. UI/JSX는 여기 없다.
 *
 * Flow-0 계정 생성 시점: A-04(submitProfile)에서 supabase.auth.signUp()으로 즉시 계정을
 * 만들고(role은 user_metadata.role), 이후 A-08(submitConsents)·A-05(verifyEmailOtp)는
 * 그 미인증 세션 위에서 후속 처리한다.
 *
 * 초대(invite) 토큰 연동: acceptInvite가 미로그인 사용자를 /signup?invite=<token>으로
 * 보내면, 위저드 각 단계 폼은 invite 토큰을 hidden 필드로 계속 전달한다. 회원가입 완료
 * 시점(verifyEmailOtp)에 invite가 있으면 accept_invitation RPC로 권한을 전개한다.
 */
export interface AuthActionState {
  error?: string;
  /** 리다이렉트 없이 화면에 남길 안내 문구(예: 비밀번호 재설정 메일 발송) */
  message?: string;
}

/** getInvitationByToken 반환 타입 — 서버 컴포넌트(A-06)에서 초대 미리보기 렌더링용 */
export interface InvitationDetails {
  token: string;
  role: Role;
  domainGrants: { domain: string; access_level: string }[];
  validUntil: string | null;
  inviteeEmail: string;
  personName: string | null;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/** 위저드 단계 간 invite 토큰을 쿼리스트링으로 이어붙인다. */
function withInvite(path: string, invite: string | null): string {
  return invite ? `${path}${path.includes("?") ? "&" : "?"}invite=${invite}` : path;
}

// ─────────────────────────────────────────────────────────
// A-02 로그인 / (deprecated) 단일 스텝 회원가입
// ─────────────────────────────────────────────────────────

/** F-AUTH-01 이메일+비밀번호 로그인 (A-02) */
export async function login(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "이메일과 비밀번호를 올바르게 입력해주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const role =
    (data.user.user_metadata?.role as Role | undefined) ??
    (await fetchRole(supabase, data.user.id));

  redirect(role ? ROLE_HOME[role] : "/home");
}

// ─────────────────────────────────────────────────────────
// Flow-0 신규 회원가입 (A-03+A-04+A-08 통합 단일 화면 → A-05)
// ─────────────────────────────────────────────────────────

/**
 * 통합 회원가입 — 역할 선택·기본 정보·약관 동의를 한 화면/한 제출로 처리한다
 * (2026-07-18, 이전 4단계 위저드 selectRole→submitProfile→submitConsents를 하나로 병합).
 * signUp() 직후에는 email-confirm 세션이 없어(data.session === null) auth.uid()가 NULL이고
 * consents_insert RLS(WITH CHECK user_id = auth.uid())가 이 시점의 INSERT를 항상 거부한다 —
 * 그래서 이전과 동일하게 동의 여부만 verify 단계로 넘기고, 실제 INSERT는 verifyEmailOtp가
 * verifyOtp로 세션을 확보한 직후에 수행한다(옛 submitConsents와 동일한 이유).
 */
export async function submitSignupForm(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupFormSchema.safeParse({
    role: formData.get("role"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    phone: formData.get("phone"),
    ageOver14: formData.get("ageOver14") === "on",
    termsAgreed: formData.get("termsAgreed") === "on",
    privacyAgreed: formData.get("privacyAgreed") === "on",
    sensitiveAgreed: formData.get("sensitiveAgreed") === "on",
    marketingAgreed: formData.get("marketingAgreed") === "on",
  });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { role, fullName, email, password, phone, marketingAgreed } = parsed.data;
  const invite = (formData.get("invite") as string | null) || null;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, full_name: fullName, phone } },
  });
  if (error) {
    return { error: error.message };
  }

  redirect(withInvite(`/signup/verify?marketing=${marketingAgreed ? "1" : "0"}`, invite));
}

/** verifyEmailOtp 성공 직후(세션 확보 후) 호출 — A-08에서 미룬 consents INSERT를 수행. */
async function insertSignupConsents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  marketingAgreed: boolean
): Promise<{ error?: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const now = new Date().toISOString();
  const types: ConsentType[] = ["terms", "privacy", "sensitive"];
  if (marketingAgreed) types.push("marketing");

  const rows = types.map((consent_type) => ({
    user_id: userId,
    consent_type,
    is_agreed: true,
    version: "v1.0",
    agreed_at: now,
    ip_address: ip,
  }));

  const { error } = await supabase.from("consents").insert(rows);
  return error ? { error: error.message } : {};
}

/** A-05 인증 코드 재발송 — Supabase signup OTP 재발송 */
export async function resendOtp(email: string): Promise<AuthActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) {
    return { error: error.message };
  }
  return { message: "인증 코드를 다시 보냈습니다." };
}

/**
 * A-05 이메일 OTP 인증 — verifyOtp 성공 시 (invite 있으면 권한 전개 후) 역할별 홈으로 이동.
 */
export async function verifyEmailOtp(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = otpVerifySchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error || !data.user) {
    return { error: "인증 코드가 올바르지 않거나 만료되었습니다." };
  }

  // A-08에서 미룬 PIPA 동의 INSERT — 세션이 이제 확보됐으므로 auth.uid()가 채워진다.
  const marketingAgreed = formData.get("marketing") === "1";
  const consentResult = await insertSignupConsents(supabase, data.user.id, marketingAgreed);
  if (consentResult.error) {
    return { error: consentResult.error };
  }

  const invite = (formData.get("invite") as string | null) || null;
  if (invite) {
    await supabase.rpc("accept_invitation", { p_token: invite });
    // 초대 전개 실패는 온보딩을 막지 않는다(보호자가 재발송 가능) — 로그인은 성립시킨다.
  }

  const role = (data.user.user_metadata?.role as Role | undefined) ?? null;
  redirect(role ? ROLE_HOME[role] : "/home");
}

// ─────────────────────────────────────────────────────────
// A-07 비밀번호 재설정
// ─────────────────────────────────────────────────────────

/**
 * A-07 1단계 — 재설정 링크 발송. 사용자 열거 방지를 위해 이메일 존재 여부와 무관하게
 * 항상 동일한 성공 메시지를 반환한다.
 */
export async function requestPasswordReset(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "올바른 이메일을 입력해주세요." };
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/reset-password/confirm`,
  });

  return { message: "등록된 이메일이면 재설정 링크가 발송됩니다." };
}

/**
 * A-07 2단계 — 재설정 링크 클릭으로 생성된 recovery 세션에서 새 비밀번호 설정 후 로그인 이동.
 */
export async function confirmPasswordReset(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = resetConfirmSchema.safeParse({
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "재설정 링크가 만료되었을 수 있습니다. 다시 요청해주세요." };
  }

  redirect("/login");
}

// ─────────────────────────────────────────────────────────
// Flow-1 이해관계자 초대 수락 (A-06)
// ─────────────────────────────────────────────────────────

/**
 * A-06 초대 조회 — 서버 컴포넌트에서 직접 호출하는 읽기 헬퍼(폼 액션 아님).
 * pending 상태의 초대만 반환하며, 없으면 null.
 *
 * invitations RLS는 authenticated 한정(inviter 본인/invitee 이메일 일치)이라 미가입자는
 * 자기 앞 초대를 볼 수 없다. A-06 미리보기는 회원가입 전(anon)에도 동작해야 하므로
 * RLS를 우회하는 서비스 롤 클라이언트로 token 정확 일치 단일 행만 조회한다.
 * (token은 필수 입력 필터이므로 테이블 덤프가 불가능하다.)
 */
export async function getInvitationByToken(token: string): Promise<InvitationDetails | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("token, role, domain_grants, valid_until, invitee_email, person:persons(full_name)")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const person = data.person as { full_name: string } | { full_name: string }[] | null;
  const personName = Array.isArray(person) ? (person[0]?.full_name ?? null) : (person?.full_name ?? null);

  return {
    token: data.token as string,
    role: data.role as Role,
    domainGrants: (data.domain_grants as { domain: string; access_level: string }[]) ?? [],
    validUntil: (data.valid_until as string | null) ?? null,
    inviteeEmail: data.invitee_email as string,
    personName,
  };
}

/**
 * A-06 초대 수락 — inviteAcceptSchema 검증 후:
 * - 로그인 상태면 accept_invitation RPC로 권한을 전개하고 역할 홈으로 이동
 * - 미로그인 상태면 역할 고정 회원가입(/signup?invite=<token>)으로 유도
 */
export async function acceptInvite(
  _prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = inviteAcceptSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) {
    return { error: "올바르지 않은 초대 링크입니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/signup?invite=${parsed.data.token}`);
  }

  const { data: role, error } = await supabase.rpc("accept_invitation", {
    p_token: parsed.data.token,
  });
  if (error) {
    return { error: error.message };
  }

  redirect(role ? ROLE_HOME[role as Role] : "/home");
}

/**
 * A-06 초대 거절 — status를 pending→declined로 갱신.
 * invitations_update RLS(security-rls: invitee 이메일 일치 + pending→declined만 허용)에
 * 의존한다. 미로그인이면 RLS가 조용히 0행 갱신으로 끝나므로, 로그인 여부를 먼저 확인하고
 * 갱신 행 수를 검사해 0건이면 에러를 반환한다(성공 오인 방지).
 */
export async function declineInvite(token: string): Promise<AuthActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const { data, error } = await supabase
    .from("invitations")
    .update({ status: "declined" })
    .eq("token", token)
    .eq("status", "pending")
    .select("id");
  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "거절할 수 있는 초대가 없습니다." };
  }
  return { message: "초대를 거절했습니다." };
}

async function fetchRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Role | null> {
  const { data } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}
