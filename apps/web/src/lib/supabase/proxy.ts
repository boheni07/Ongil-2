import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME } from "@ongil/shared";
import type { Role } from "@ongil/validation";

const AUTH_PREFIXES = ["/login", "/signup"];
const APP_PREFIXES = ["/dashboard", "/home", "/attachments"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));
}

/**
 * Next.js 16 Proxy(구 Middleware)에서 호출하는 세션 갱신 + 역할별 라우트 가드.
 * 공식 @supabase/ssr 패턴을 따른다: 요청/응답 쿠키를 동기화해야
 * Server Component에서 만료된 세션을 보지 않는다.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 중요: getSession()이 아닌 getUser()를 사용해야 매 요청마다 Supabase Auth
  // 서버에 토큰을 검증한다 (getSession은 쿠키만 읽어 위조된 세션을 걸러내지 못함).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = matchesPrefix(pathname, AUTH_PREFIXES);
  const isAppRoute = matchesPrefix(pathname, APP_PREFIXES);

  // 비로그인 사용자가 (app) 영역 접근 → 로그인 페이지로
  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 로그인 사용자가 (auth) 영역(로그인/회원가입) 접근 → 본인의 ROLE_HOME으로
  if (user && isAuthRoute) {
    const role = await getUserRole(supabase, user.id);
    const url = request.nextUrl.clone();
    url.pathname = role ? ROLE_HOME[role] : "/home";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

async function getUserRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<Role | null> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as Role;
}
