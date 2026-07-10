import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * 서비스 롤 Supabase 클라이언트 — RLS를 우회하는 서버 전용 클라이언트.
 *
 * ⚠️ SUPABASE_SERVICE_ROLE_KEY는 절대 브라우저에 노출되면 안 된다. 키가 NEXT_PUBLIC_ 접두사가
 * 아니므로 클라이언트 번들에는 값이 주입되지 않으며, 추가 방어로 브라우저 실행 시 즉시 throw한다.
 * Server Action / Route Handler 등 서버 경계 안에서만 호출할 것.
 *
 * 사용처: 미인증(anon) 방문자가 초대 토큰으로 A-06을 미리보는 경로처럼, RLS로는 표현할 수
 * 없는(= "쿼리가 반드시 token으로 필터링되도록 강제") 조회를 안전하게 처리할 때. 반드시
 * 호출부에서 정확한 필터(예: .eq("token", token))로 단일 행만 조회해야 한다 — 이 클라이언트는
 * RLS를 우회하므로 필터 없는 조회는 테이블 전체를 노출한다.
 */
export function createServiceRoleClient() {
  if (typeof window !== "undefined") {
    throw new Error("createServiceRoleClient는 서버에서만 호출할 수 있습니다.");
  }
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
