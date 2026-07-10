import { createClient as createSbClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "./server";

export interface RequestAuth {
  supabase: SupabaseClient;
  user: User | null;
}

/**
 * 요청에서 인증된 Supabase 클라이언트를 만든다.
 * - Authorization: Bearer <jwt> 헤더가 있으면 그 토큰 스코프 클라이언트(스크립트/모바일용).
 * - 없으면 쿠키 세션 기반 SSR 클라이언트(브라우저용).
 * 둘 다 사용자 JWT 로 동작하므로 이후 storage/db 호출에 RLS 가 그대로 적용된다.
 */
export async function authFromRequest(request: Request): Promise<RequestAuth> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;

  if (bearer) {
    const supabase = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data } = await supabase.auth.getUser(bearer);
    return { supabase, user: data.user ?? null };
  }

  const supabase = await createCookieClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}
