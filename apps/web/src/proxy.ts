import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 Proxy(구 middleware.ts). 세션 갱신 + 역할별 라우트 가드.
 * 상세 로직은 lib/supabase/proxy.ts의 updateSession()에 있다.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 정적 파일, 이미지 최적화, 파비콘 등은 제외.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
