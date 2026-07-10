import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { authFromRequest } from "@/lib/supabase/from-request";
import { issueReauthToken, REAUTH_COOKIE, REAUTH_TTL_SECONDS } from "@/lib/reauth";

/**
 * 세션 재인증(step-up). 민감 도메인(MED/LEG) 첨부 다운로드 전에 호출.
 * body: { password }. 로그인된 사용자의 이메일 + 입력 비밀번호를 재검증하고,
 * 성공 시 5분 TTL 재인증 토큰을 httpOnly 쿠키 + JSON({ token }) 으로 발급한다.
 */
export async function POST(request: Request) {
  const { user } = await authFromRequest(request);
  if (!user?.email) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
  }

  // 메인 세션을 건드리지 않도록 persistSession:false 인 일회성 클라이언트로 비밀번호만 검증.
  const ephemeral = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await ephemeral.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (error || data.user?.id !== user.id) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  const token = issueReauthToken(user.id);
  const res = NextResponse.json({ ok: true, token, expiresIn: REAUTH_TTL_SECONDS });
  res.cookies.set(REAUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REAUTH_TTL_SECONDS,
  });
  return res;
}
