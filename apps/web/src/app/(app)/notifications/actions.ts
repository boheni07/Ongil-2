"use server";

import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/notify";

/**
 * G-05(추정) 알림함 — GlobalHeader 알림벨의 진입점(2026-07-18 Wave D-1 스팟체크에서
 * onNotificationClick 콜백이 layout.tsx에서 한 번도 전달되지 않아 클릭이 아무 반응도
 * 없던 결함 발견 후 신설). notifications RLS(recipient_id=auth.uid())가 최종 접근 통제다.
 */

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  isRead: boolean;
  sentAt: string;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, sent_at")
    .eq("recipient_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((n) => ({
    id: n.id as string,
    type: n.type as NotificationType,
    title: n.title as string,
    body: n.body as string | null,
    isRead: Boolean(n.is_read),
    sentAt: n.sent_at as string,
  }));
}

export async function markNotificationRead(id: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
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

export async function markAllNotificationsRead(): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
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
