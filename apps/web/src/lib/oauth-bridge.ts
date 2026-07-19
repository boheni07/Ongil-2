import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE_HOME } from "@ongil/shared";
import type { Role } from "@ongil/validation";

/**
 * F-AUTH-02(카카오/네이버 OAuth) 공용 콜백 브리지 — docs/01-prd.md §5-1-1 설계를 그대로 구현한다.
 *
 * ⚠️ 이 코드는 이 환경에서 라이브로 검증되지 않았다 — 카카오/네이버 개발자 콘솔 앱 등록·
 * 클라이언트 시크릿 발급은 이 프로젝트 소유자만 할 수 있는 외부 작업이라, 실제 콜백 왕복을
 * 여기서 실행해볼 방법이 없다(2026-07-18 Wave M-5). 설계 문서의 요구사항을 코드로 정확히
 * 옮기는 데 집중했고, 실제 카카오/네이버 앱 등록 후 최초 로그인 시도에서 재검증이 필요하다.
 *
 * 카카오도 OIDC(id_token) 대신 네이버와 동일한 순수 OAuth2 Authorization Code 브리지로
 * 구현한다 — 카카오 로그인 REST API가 이 방식도 지원하고, GoTrue의 커스텀 OIDC 프로바이더
 * 등록(대시보드 설정, 여기서 확인 불가)에 의존하지 않아 두 provider의 코드 경로가 완전히
 * 대칭이 된다(PRD가 명시한 "provider별 통합 경로 비대칭"은 프로필 조회 API 형태에서만
 * 남고, 세션 성립 방식은 동일해진다).
 *
 * 신규/기존 계정 판별: (auth_provider, oauth_subject) 조합이 신뢰 소스다(이메일 자동 연결 금지).
 * - 기존 계정이면 magiclink 브리지로 세션만 성립시키고 역할 홈으로 보낸다.
 * - 신규면 role 없이 auth.users만 만든다(handle_new_user 트리거는 role이 없으면
 *   public.users row 생성을 건너뛰는 기존 안전장치를 그대로 활용) → 세션 성립 후
 *   /signup/oauth-complete(A-03 역할 선택 + A-08 동의)로 보낸다. 그 단계에서
 *   completeOAuthSignup 액션이 public.users row를 직접 INSERT한다(서비스 롤 필요 —
 *   users_insert RLS 정책이 없어 authenticated로는 불가능하기 때문).
 */

export interface OAuthProfile {
  provider: "kakao" | "naver";
  /** provider 고유 ID(카카오 id / 네이버 id). 계정 동일성의 유일한 신뢰 소스. */
  subject: string;
  /** provider가 이메일 제공에 동의를 받지 못했으면 null. */
  email: string | null;
  fullName: string;
}

function placeholderEmail(provider: string, subject: string): string {
  return `${provider}_${subject}@oauth.ongil.local`;
}

/**
 * 세션이 없는 auth.users 계정에 매직링크를 발급해 즉시 verifyOtp로 세션을 성립시킨다.
 * (관리자 API로 "임의 사용자 세션 생성"을 직접 하는 공개 메서드가 없어, admin.generateLink가
 * 만드는 magiclink 토큰을 서버가 스스로 소비하는 방식으로 우회한다 — PRD가 명시한
 * "generateLink(magiclink/OTP) 또는 동등 패턴" 그대로.)
 */
async function establishSession(email: string): Promise<{ error?: string }> {
  const admin = createServiceRoleClient();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData) {
    return { error: `세션 생성에 실패했습니다: ${linkErr?.message ?? "알 수 없는 오류"}` };
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    return { error: "세션 생성에 실패했습니다: 토큰을 발급받지 못했습니다." };
  }

  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyErr) {
    return { error: `세션 확인에 실패했습니다: ${verifyErr.message}` };
  }
  return {};
}

/**
 * OAuth 콜백 라우트가 프로필을 확보한 뒤 호출하는 공용 처리 — 계정 조회/생성 + 세션 성립 +
 * 리다이렉트까지 전부 담당한다. 콜백 라우트는 provider별 code→token→profile 교환만 하면 된다.
 */
export async function completeOAuthCallback(
  profile: OAuthProfile,
  origin: string
): Promise<NextResponse> {
  const admin = createServiceRoleClient();

  const { data: existing } = await admin
    .from("users")
    .select("id, email, role")
    .eq("auth_provider", profile.provider)
    .eq("oauth_subject", profile.subject)
    .maybeSingle();

  if (existing) {
    const { error } = await establishSession(existing.email as string);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
    }
    const role = existing.role as Role;
    return NextResponse.redirect(`${origin}${ROLE_HOME[role] ?? "/home"}`);
  }

  // 신규 — 2차 참고: 같은 이메일의 기존 이메일 가입 계정이 있어도 자동 연결하지 않는다.
  const email = profile.email ?? placeholderEmail(profile.provider, profile.subject);
  const emailVerified = Boolean(profile.email);

  if (profile.email) {
    const { data: emailOwner } = await admin
      .from("users")
      .select("id")
      .eq("email", profile.email)
      .eq("auth_provider", "email")
      .maybeSingle();
    if (emailOwner) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(
          "이미 이메일로 가입된 계정이 있습니다. 이메일로 로그인한 뒤 설정에서 소셜 계정을 연결해주세요."
        )}`
      );
    }
  }

  // role은 아직 모른다 — handle_new_user 트리거가 role 없는 메타데이터는 public.users row
  // 생성을 건너뛰도록 이미 설계돼 있으므로 의도적으로 넘기지 않는다.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      auth_provider: profile.provider,
      oauth_subject: profile.subject,
      email_verified: emailVerified,
      oauth_full_name: profile.fullName,
    },
  });
  if (createErr || !created?.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(`계정 생성에 실패했습니다: ${createErr?.message ?? ""}`)}`
    );
  }

  const { error } = await establishSession(email);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }

  return NextResponse.redirect(`${origin}/signup/oauth-complete`);
}
