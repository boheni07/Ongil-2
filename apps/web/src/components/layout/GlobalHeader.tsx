"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, LogOut, Settings, UserRoundPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
} from "@/components/ui/dropdown-menu";

/**
 * docs/03-uiux.md §6-1 `GlobalHeader` — 높이 56px(`--hh`), 로고·알림·프로필.
 *
 * 2026-07-19: `/prototypes` 전 역할(web-guardian/teacher/social-worker/therapist/supporter.html)
 * 원문 대조 결과 아바타·드롭다운은 항상 헤더 우측(로고—spacer—알림벨—아바타)에 있고, 사이드바
 * 최하단에는 없다는 걸 확인해 원래 위치로 되돌렸다(한때 사이드바 최하단 UserMenu로 옮겼었음).
 * 드롭다운 항목명(내 정보/설정/로그아웃)만 이전 요청대로 유지 — 정적 프로토타입은 아바타
 * 드롭다운 내용까지는 명시하지 않아 이 부분은 자유도가 있다.
 */
export interface GlobalHeaderProps {
  userName?: string | null;
  userAvatarUrl?: string | null;
  notificationCount?: number;
  className?: string;
  /** 보호자 전용 "당사자 선택" 콤보박스(프로토타입 `.person-select`) — 로고 옆에 렌더링. */
  personSelector?: ReactNode;
}

export function GlobalHeader({
  userName,
  userAvatarUrl,
  notificationCount = 0,
  className,
  personSelector,
}: GlobalHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      data-slot="global-header"
      className={cn(
        "relative z-10 flex h-(--hh) items-center justify-between border-b border-border bg-white px-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-0.5 text-lg font-extrabold" aria-label="온길 홈으로 이동">
          <span className="text-primary-600">온</span>
          <span className="text-accent-stone">길</span>
        </Link>
        {personSelector}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          render={<Link href="/notifications" />}
          aria-label={notificationCount > 0 ? `알림 ${notificationCount}건` : "알림"}
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

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={userName ? `${userName}님 계정 메뉴` : "계정 메뉴"}
            className="flex min-h-11 min-w-11 items-center gap-2 rounded-(--br-md) px-1 outline-none hover:bg-primary-50"
          >
            <Avatar className="size-8">
              {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt="" /> : null}
              <AvatarFallback>{userName ? userName.slice(0, 1) : "?"}</AvatarFallback>
            </Avatar>
            {userName ? <span className="text-sm font-medium text-accent-stone">{userName}</span> : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLinkItem render={<Link href="/settings/profile" />}>
              <UserRoundPen className="mr-2 size-4" aria-hidden="true" />
              내 정보
            </DropdownMenuLinkItem>
            <DropdownMenuLinkItem render={<Link href="/settings" />}>
              <Settings className="mr-2 size-4" aria-hidden="true" />
              설정
            </DropdownMenuLinkItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 size-4" aria-hidden="true" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
