import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * F-AUTH-02 네이버 로그인 1단계 — 인가 요청. 카카오와 동일한 순수 OAuth2 브리지 패턴
 * (apps/web/src/lib/oauth-bridge.ts 상단 주석 참고).
 *
 * origin은 `Origin` 헤더가 아니라 `req.nextUrl.origin`에서 구한다 — 일반 GET 네비게이션에는
 * 브라우저가 `Origin` 헤더를 보내지 않는다(2026-07-18 카카오 라우트에서 실제 500 재현·발견).
 */
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const clientId = process.env.NAVER_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("네이버 로그인이 아직 설정되지 않았습니다.")}`
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/auth/naver/callback`);
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set("naver_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
