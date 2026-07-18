"use client";

import { useState } from "react";
import { markAllNotificationsRead, markNotificationRead, type NotificationItem } from "./actions";
import { NOTIFICATION_TYPE_LABEL } from "@/lib/notification-types";
import { Button } from "@/components/ui/button";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${iso.slice(0, 10)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function NotificationList({ initialItems }: { initialItems: NotificationItem[] }) {
  const [items, setItems] = useState(initialItems);
  const unreadCount = items.filter((n) => !n.isRead).length;

  async function handleRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await markNotificationRead(id);
  }

  async function handleReadAll() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsRead();
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-body text-muted-foreground">
          {unreadCount > 0 ? `안 읽은 알림 ${unreadCount}건` : "모두 읽었습니다."}
        </p>
        {unreadCount > 0 && (
          <Button type="button" variant="outline" className="h-9" onClick={handleReadAll}>
            모두 읽음 처리
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-(--br-md) bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          알림이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => !n.isRead && handleRead(n.id)}
                className={`flex w-full flex-col gap-1 rounded-(--br-md) p-4 text-left ring-1 ring-foreground/10 transition-colors ${
                  n.isRead ? "bg-white" : "bg-primary-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.isRead && (
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-domain-med-accent" />
                  )}
                  <span className="text-caption font-semibold text-primary-700">
                    {NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}
                  </span>
                  <span className="text-caption text-muted-foreground">{formatDateTime(n.sentAt)}</span>
                </div>
                <p className="text-body font-bold text-foreground">{n.title}</p>
                {n.body && <p className="text-body text-muted-foreground">{n.body}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
