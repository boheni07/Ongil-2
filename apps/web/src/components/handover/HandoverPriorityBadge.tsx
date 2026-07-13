import { cn } from "@/lib/utils";

/**
 * 인수인계 중요도 배지. docs/03-uiux.md에 전용 스펙이 없어 기존 토큰으로 간단히 표현한다.
 * high=주의(빨강) / normal=보통(회색) / low=참고(연한 파랑).
 */
const STYLES: Record<string, { label: string; className: string }> = {
  high: { label: "중요", className: "bg-red-50 text-red-700" },
  normal: { label: "보통", className: "bg-[#F3F4F6] text-[#6B7280]" },
  low: { label: "참고", className: "bg-blue-50 text-blue-700" },
};

export function HandoverPriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const style = STYLES[priority] ?? STYLES.normal;
  return (
    <span
      data-slot="handover-priority-badge"
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-(--br-sm) px-2 text-[12px] font-medium leading-none",
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}
