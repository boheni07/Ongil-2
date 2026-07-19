"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRoundPen, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
} from "@/components/ui/dropdown-menu";

/**
 * 사이드바 최하단 로그인 사용자 메뉴(2026-07-19) — 이전엔 GlobalHeader 우측(알림 옆)에
 * 있던 아바타·드롭다운을 이 자리로 옮겼다(알림 벨만 헤더에 남긴다). 클릭 시 내 정보(프로필
 * 수정 화면 재사용)·설정·로그아웃 3항목 — "설정"이 사이드바 상단 메뉴에서 빠지는 대신 이
 * 메뉴 안으로 흡수된다.
 */
export interface UserMenuProps {
  userName?: string | null;
  userAvatarUrl?: string | null;
  collapsed?: boolean;
}

export function UserMenu({ userName, userAvatarUrl, collapsed = false }: UserMenuProps) {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="border-t border-primary-700 p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={userName ? `${userName}님 계정 메뉴` : "계정 메뉴"}
          className={`flex min-h-11 w-full items-center gap-2 rounded-(--br-md) px-2 text-primary-100 outline-none hover:bg-primary-700/60 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Avatar className="size-8 shrink-0">
            {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt="" /> : null}
            <AvatarFallback>{userName ? userName.slice(0, 1) : "?"}</AvatarFallback>
          </Avatar>
          <span className={`truncate text-sm font-medium text-white ${collapsed ? "sr-only" : ""}`}>
            {userName ?? "내 계정"}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
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
  );
}
