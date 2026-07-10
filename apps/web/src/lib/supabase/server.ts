import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * 서버 컴포넌트 / Server Action / Route Handler 전용 Supabase 클라이언트.
 * Next.js 16: `cookies()`는 항상 비동기이므로 이 함수도 async다.
 *
 * 주의: 서버 컴포넌트 내부에서는 `cookies().set()`이 항상 성공하는 것은
 * 아니다(렌더링 중 쿠키를 쓸 수 없는 경우가 있음). 공식 패턴대로 무시하고,
 * 실제 세션 갱신은 proxy.ts에서 수행한다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출된 경우 — proxy.ts가 세션 갱신을 담당하므로 무시해도 안전하다.
          }
        },
      },
    }
  );
}
