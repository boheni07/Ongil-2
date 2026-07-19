import { supabase } from "./supabase";

/**
 * Wave M-1(docs/11-livinglab-mega-workshop.md) — 알림함(모바일). 웹 Server Action
 * (apps/web/src/app/(app)/notifications/actions.ts)의 로직을 Supabase 직접 호출로
 * 동일하게 재현한다. notifications RLS(recipient_id=auth.uid())가 최종 접근 통제다.
 */

export type NotificationType =
  | "record_new"
  | "permission_grant"
  | "handover"
  | "reminder"
  | "record_confirm"
  | "life_stage_youth"
  | "life_stage_adult"
  | "life_stage_senior"
  | "permission_expiry_warning"
  | "permission_audit_summary";

/** notifications.type → 표시용 한글 라벨(웹 lib/notification-types.ts와 동일). */
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  record_new: "새 기록",
  permission_grant: "권한 변경",
  handover: "인수인계",
  reminder: "리마인더",
  record_confirm: "기록 확인 요청",
  life_stage_youth: "생애주기 전환(청소년)",
  life_stage_adult: "생애주기 전환(성인)",
  life_stage_senior: "생애주기 전환(노년)",
  permission_expiry_warning: "권한 만료 예정",
  permission_audit_summary: "권한 감사 요약",
};

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  isRead: boolean;
  sentAt: string;
}

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("is_read", false);
  return count ?? 0;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, sent_at")
    .eq("recipient_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((n) => ({
    id: n.id as string,
    type: n.type as NotificationType,
    title: n.title as string,
    body: (n.body as string | null) ?? null,
    isRead: Boolean(n.is_read),
    sentAt: n.sent_at as string,
  }));
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: `알림 읽음 처리에 실패했습니다: ${error.message}` };
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .eq("is_read", false);
  if (error) return { error: `알림 읽음 처리에 실패했습니다: ${error.message}` };
  return { ok: true };
}
