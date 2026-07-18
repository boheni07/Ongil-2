"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §6-1 `Sidebar` — 220px(펼침) / 64px(접힘).
 * `--sw` / `--sw-collapsed` 토큰을 사용해 폭을 전환한다.
 *
 * icon은 컴포넌트 참조(LucideIcon)가 아니라 이미 렌더링된 JSX를 받는다 — Server Component인
 * layout.tsx가 Client Component인 이 컴포넌트로 원시 함수 참조를 props로 넘기면 RSC 직렬화
 * 경계 위반으로 크래시한다("Functions cannot be passed directly to Client Components").
 */
export interface SidebarItem {
  label: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
}

export interface SidebarProps {
  items: SidebarItem[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  className?: string;
}

export function Sidebar({ items, collapsed = false, onToggleCollapsed, className }: SidebarProps) {
  return (
    <nav
      aria-label="주 메뉴"
      data-slot="sidebar"
      className={cn(
        "flex h-full flex-col bg-primary-800 text-white transition-[width]",
        collapsed ? "w-(--sw-collapsed)" : "w-(--sw)",
        className
      )}
    >
      <ul className="flex flex-1 flex-col gap-1 p-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-(--br-md) px-3 text-sm font-medium transition-colors",
                item.active ? "bg-primary-700 text-white" : "text-primary-100 hover:bg-primary-700/60",
                collapsed && "justify-center px-0"
              )}
            >
              <span className="size-5 shrink-0 [&_svg]:size-5" aria-hidden="true">
                {item.icon}
              </span>
              <span className={cn(collapsed && "sr-only")}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {onToggleCollapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          className="flex min-h-11 items-center justify-center gap-2 border-t border-primary-700 text-primary-100 hover:bg-primary-700/60"
        >
          {collapsed ? (
            <ChevronRight className="size-5" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="size-5" aria-hidden="true" />
              <span className="text-sm">접기</span>
            </>
          )}
        </button>
      ) : null}
    </nav>
  );
}
