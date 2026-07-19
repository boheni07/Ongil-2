"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §6-1 `Sidebar` — 220px(펼침) / 64px(접힘).
 * `--sw` / `--sw-collapsed` 토큰을 사용해 폭을 전환한다.
 *
 * icon은 컴포넌트 참조(LucideIcon)가 아니라 이미 렌더링된 JSX를 받는다 — Server Component인
 * layout.tsx가 Client Component인 이 컴포넌트로 원시 함수 참조를 props로 넘기면 RSC 직렬화
 * 경계 위반으로 크래시한다("Functions cannot be passed directly to Client Components").
 *
 * 현재 위치 표시는 `usePathname()`으로 이 컴포넌트가 직접 판정한다 — layout.tsx(Server
 * Component)는 pathname을 모르므로 이전엔 `SidebarItem.active`를 아무도 채워주지 않아
 * 사이드바가 현재 페이지를 한 번도 강조 표시한 적이 없었다(2026-07-18 리빙랩 워크숍에서 발견).
 */
export interface SidebarItem {
  label: string;
  href: string;
  icon: ReactNode;
}

export interface SidebarProps {
  items: SidebarItem[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  className?: string;
  /** 최하단 보조 영역(예: 개발용 계정 전환 콤보박스) — 접힘 상태에선 폭이 부족해 숨긴다. */
  footer?: ReactNode;
}

export function Sidebar({ items, collapsed = false, onToggleCollapsed, className, footer }: SidebarProps) {
  const pathname = usePathname();

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
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            // href만으로 키를 만들면 "IEP 점검"/"ISP 점검"처럼 전용 화면이 없어 홈과 같은
            // href를 공유하는 항목과 충돌한다(React 중복 키 경고).
            <li key={`${item.href}::${item.label}`}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-(--br-md) px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-700 text-white before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-1 before:rounded-full before:bg-accent-amber"
                    : "text-primary-100 hover:bg-primary-700/60",
                  collapsed && "justify-center px-0"
                )}
              >
                <span className="size-5 shrink-0 [&_svg]:size-5" aria-hidden="true">
                  {item.icon}
                </span>
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {!collapsed && footer}

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
