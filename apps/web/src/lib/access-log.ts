import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { DomainKey } from "@ongil/validation";

/**
 * G-40 접근 로그 기록 헬퍼 — access_logs INSERT(docs/05-erd.md §2-9 / §4-4).
 *
 * access_logs_insert RLS는 WITH CHECK (true)라 로그인 사용자면 누구나 기록할 수 있고,
 * 열람은 access_logs_select(주보호자 한정)가 통제한다. 여기서는 기록만 담당한다.
 *
 * 감사 로그 기록 실패가 원래 사용자 작업(기록 조회·작성·수정)을 막으면 안 되므로
 * 모든 오류를 삼키고 조용히 반환한다(감사 로그는 best-effort).
 *
 * 이번 라운드는 view/create/update/export 4종만 다룬다 — 'delete'와 접근 "거부(deny)"
 * 로깅은 별도 사전 권한 체크 계층이 필요해 범위 밖이다(access_logs.action CHECK에도
 * 'deny'가 없다).
 */
export type AccessLogAction = "view" | "create" | "update" | "export";

export async function logAccess(
  personId: string,
  action: AccessLogAction,
  opts?: { recordId?: string; domain?: DomainKey }
): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      userAgent = h.get("user-agent");
      ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    } catch {
      // 헤더를 읽을 수 없는 컨텍스트여도 로그 기록 자체는 진행한다.
    }

    await supabase.from("access_logs").insert({
      actor_id: user.id,
      person_id: personId,
      record_id: opts?.recordId ?? null,
      action,
      domain: opts?.domain ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch {
    // 감사 로그 실패는 사용자 작업을 막지 않는다 — 조용히 무시.
  }
}
