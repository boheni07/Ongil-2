"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, LogOut, Settings } from "lucide-react";
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
 * 알림벨·프로필 메뉴는 자체적으로 클릭 동작을 갖는다(2026-07-18 Wave D-1 스팟체크 발견 —
 * 이전엔 onNotificationClick/onProfileClick 콜백 props에 의존했는데 (app)/layout.tsx가
 * Server Component라 함수를 넘길 수 없어 결국 아무도 전달하지 않았고, 두 버튼 모두 클릭해도
 * 반응이 없는 상태로 방치돼 있었다). 서버 컴포넌트는 이제 notificationCount(숫자, 직렬화
 * 가능)만 넘기면 된다.
 */
export interface GlobalHeaderProps {
  userName?: string | null;
  userAvatarUrl?: string | null;
  notificationCount?: number;
  className?: string;
}

export function GlobalHeader({
  userName,
  userAvatarUrl,
  notificationCount = 0,
  className,
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
      <Link href="/" className="flex items-center gap-0.5 text-lg font-extrabold" aria-label="온길 홈으로 이동">
        <span className="text-primary-600">온</span>
        <span className="text-accent-stone">길</span>
      </Link>

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
            aria-label={userName ? `${userName}님 프로필 메뉴` : "프로필 메뉴"}
            className="flex min-h-11 min-w-11 items-center gap-2 rounded-(--br-md) px-1 outline-none hover:bg-primary-50"
          >
            <Avatar className="size-8">
              {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt="" /> : null}
              <AvatarFallback>{userName ? userName.slice(0, 1) : "?"}</AvatarFallback>
            </Avatar>
            {userName ? <span className="text-sm font-medium text-accent-stone">{userName}</span> : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
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
