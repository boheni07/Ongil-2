import { type NextRequest, NextResponse } from "next/server";
import { completeOAuthCallback, type OAuthProfile } from "@/lib/oauth-bridge";

interface KakaoTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface KakaoUserResponse {
  id?: number;
  kakao_account?: {
    email?: string;
    email_needs_agreement?: boolean;
    profile?: { nickname?: string };
  };
}

/**
 * F-AUTH-02 카카오 로그인 2단계 — 콜백. 인가코드를 액세스 토큰으로 교환하고
 * `/v2/user/me`로 프로필을 조회한 뒤 completeOAuthCallback에 위임한다.
 * ⚠️ 라이브 검증 미완료(oauth-bridge.ts 상단 주석 참고) — 실제 카카오 앱 등록 후 재검증 필요.
 */
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get("kakao_oauth_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("카카오 로그인 요청이 올바르지 않습니다. 다시 시도해주세요.")}`
    );
  }

  const clientId = process.env.KAKAO_CLIENT_ID;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET; // 카카오는 시크릿 사용이 선택이지만 보안 설정 시 필수.
  if (!clientId) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("카카오 로그인이 아직 설정되지 않았습니다.")}`
    );
  }

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/kakao/callback`,
    code,
  });
  if (clientSecret) tokenParams.set("client_secret", clientSecret);

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });
  const tokenData = (await tokenRes.json()) as KakaoTokenResponse;
  if (!tokenData.access_token) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        `카카오 인증에 실패했습니다: ${tokenData.error_description ?? tokenData.error ?? "알 수 없는 오류"}`
      )}`
    );
  }

  const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const kakaoUser = (await profileRes.json()) as KakaoUserResponse;
  if (!kakaoUser.id) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("카카오 프로필 조회에 실패했습니다.")}`
    );
  }

  const profile: OAuthProfile = {
    provider: "kakao",
    subject: String(kakaoUser.id),
    email: kakaoUser.kakao_account?.email_needs_agreement === false
      ? (kakaoUser.kakao_account?.email ?? null)
      : null,
    fullName: kakaoUser.kakao_account?.profile?.nickname ?? "카카오 사용자",
  };

  const res = await completeOAuthCallback(profile, origin);
  res.cookies.delete("kakao_oauth_state");
  return res;
}
