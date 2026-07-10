"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트.
 * 공식 @supabase/ssr 패턴 — 매 호출마다 새 인스턴스를 만들어도 안전하다
 * (내부적으로 싱글턴 스토리지를 공유한다).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
