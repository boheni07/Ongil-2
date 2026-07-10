"use client";

import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §7-1 당사자 모드 아이콘 선택 버튼 — P-02 자기표현·S-12 건강/식사에서 재사용.
 * 아이콘 72px, 터치 타깃 56px 이상, 폰트 20px+(text-person-base), 고대비 선택 상태.
 */
export interface IconOptionProps {
  emoji: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** supporter처럼 데스크톱에서 조금 작은 변형이 필요하면 compact */
  size?: "person" | "compact";
  className?: string;
}

export function IconOption({ emoji, label, selected, onSelect, size = "person", className }: IconOptionProps) {
  const person = size === "person";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-(--br-xl) border-2 bg-white text-center font-semibold transition-colors",
        person
          ? "min-h-[112px] min-w-[112px] px-4 py-5 text-person-base"
          : "min-h-[88px] min-w-[88px] px-3 py-4 text-sm",
        selected
          ? "border-primary-600 bg-primary-50 text-primary-800"
          : "border-border text-accent-stone hover:border-primary-400"
      )}
    >
      <span aria-hidden="true" className={cn("leading-none", person ? "text-[56px]" : "text-4xl")}>
        {emoji}
      </span>
      <span className={cn(className)}>{label}</span>
    </button>
  );
}
