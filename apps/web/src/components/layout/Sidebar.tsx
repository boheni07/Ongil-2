"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §6-1 `Sidebar` — 220px(펼침) / 64px(접힘).
 * `--sw` / `--sw-collapsed` 토큰을 사용해 폭을 전환한다.
 */
export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
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
        {items.map((item) => {
          const Icon = item.icon;
          return (
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
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
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
