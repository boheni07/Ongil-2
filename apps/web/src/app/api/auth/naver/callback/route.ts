import { type NextRequest, NextResponse } from "next/server";
import { completeOAuthCallback, type OAuthProfile } from "@/lib/oauth-bridge";

interface NaverTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface NaverProfileResponse {
  resultcode?: string;
  message?: string;
  response?: { id?: string; email?: string; name?: string };
}

/**
 * F-AUTH-02 네이버 로그인 2단계 — 콜백. 네이버는 OIDC discovery/id_token을 제공하지 않아
 * PRD §5-1-1이 명시한 대로 순수 OAuth2 Authorization Code 교환 + `/v1/nid/me` 프로필 조회로
 * 직접 브리지를 구현한다. ⚠️ 라이브 검증 미완료(oauth-bridge.ts 상단 주석 참고).
 */
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get("naver_oauth_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("네이버 로그인 요청이 올바르지 않습니다. 다시 시도해주세요.")}`
    );
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("네이버 로그인이 아직 설정되지 않았습니다.")}`
    );
  }

  const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("state", state);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = (await tokenRes.json()) as NaverTokenResponse;
  if (!tokenData.access_token) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        `네이버 인증에 실패했습니다: ${tokenData.error_description ?? tokenData.error ?? "알 수 없는 오류"}`
      )}`
    );
  }

  const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const naverProfile = (await profileRes.json()) as NaverProfileResponse;
  if (naverProfile.resultcode !== "00" || !naverProfile.response?.id) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("네이버 프로필 조회에 실패했습니다.")}`
    );
  }

  const profile: OAuthProfile = {
    provider: "naver",
    subject: naverProfile.response.id,
    email: naverProfile.response.email ?? null,
    fullName: naverProfile.response.name ?? "네이버 사용자",
  };

  const res = await completeOAuthCallback(profile, origin);
  res.cookies.delete("naver_oauth_state");
  return res;
}
