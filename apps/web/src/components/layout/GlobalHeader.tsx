"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/**
 * docs/03-uiux.md §6-1 `GlobalHeader` — 높이 56px(`--hh`), 로고·알림·프로필.
 */
export interface GlobalHeaderProps {
  userName?: string | null;
  userAvatarUrl?: string | null;
  notificationCount?: number;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  className?: string;
}

export function GlobalHeader({
  userName,
  userAvatarUrl,
  notificationCount = 0,
  onNotificationClick,
  onProfileClick,
  className,
}: GlobalHeaderProps) {
  return (
    <header
      data-slot="global-header"
      className={cn(
        "flex h-(--hh) items-center justify-between border-b border-border bg-white px-4",
        className
      )}
    >
      <Link href="/" className="flex items-center gap-0.5 text-lg font-extrabold" aria-label="온길 홈으로 이동">
        <span className="text-primary-600">온</span>
        <span className="text-accent-stone">길</span>
      </Link>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={notificationCount > 0 ? `알림 ${notificationCount}건` : "알림"}
          onClick={onNotificationClick}
          className="relative min-h-11 min-w-11"
        >
          <Bell className="size-5" aria-hidden="true" />
          {notificationCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-domain-med-accent"
            />
          ) : null}
        </Button>

        <button
          type="button"
          onClick={onProfileClick}
          aria-label={userName ? `${userName}님 프로필 메뉴` : "프로필 메뉴"}
          className="flex min-h-11 min-w-11 items-center gap-2 rounded-(--br-md) px-1 hover:bg-primary-50"
        >
          <Avatar className="size-8">
            {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt="" /> : null}
            <AvatarFallback>{userName ? userName.slice(0, 1) : "?"}</AvatarFallback>
          </Avatar>
          {userName ? <span className="text-sm font-medium text-accent-stone">{userName}</span> : null}
        </button>
      </div>
    </header>
  );
}
