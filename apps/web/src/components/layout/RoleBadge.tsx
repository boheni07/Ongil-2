"use client";

import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §6-1 `RoleBadge` — 52px, 역할 선택 탭.
 * 한 사용자가 여러 역할/대상자 컨텍스트를 오갈 때(예: 활동지원사 + 보호자 겸직) 쓰는
 * 탭 형태의 배지. 여러 개를 나란히 놓아 `var(--rb)` 높이의 역할 선택 탭 바를 구성한다.
 */
export interface RoleBadgeProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function RoleBadge({ label, active, onClick, icon, className }: RoleBadgeProps) {
  return (
    <button
      type="button"
      data-slot="role-badge"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-(--rb) min-w-11 items-center gap-1.5 border-b-2 px-4 text-sm font-semibold transition-colors",
        active
          ? "border-primary-600 text-primary-700"
          : "border-transparent text-accent-pebble hover:text-accent-stone",
        className
      )}
    >
      {icon}
      {label}
    </button>
  );
}
