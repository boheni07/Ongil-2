import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * F-AUTH-02 카카오 로그인 1단계 — 인가 요청. `/login`·`/signup`의 "카카오로 시작하기" 버튼이
 * 이 라우트로 이동시킨다. state를 httpOnly 쿠키에 저장해 콜백에서 CSRF를 검증한다.
 *
 * origin은 요청 헤더의 `Origin`이 아니라 요청 URL 자체(`req.nextUrl.origin`)에서 구한다 —
 * `Origin` 헤더는 fetch/XHR 요청에만 실려오고 일반 GET 네비게이션(링크 클릭)에는 브라우저가
 * 보내지 않아, 그 값에 의존하면 이 라우트가 항상 빈 origin으로 URL 생성에 실패한다
 * (2026-07-18 라이브 테스트로 실제 500 에러 재현·발견).
 */
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const clientId = process.env.KAKAO_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("카카오 로그인이 아직 설정되지 않았습니다.")}`
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/auth/kakao/callback`);
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set("kakao_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
