import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §6-1 `SplitPane` — CSS Grid `300px 1fr`, min-width 1024px.
 * 예: T-14 IEP 점검(좌: 목표 목록 / 우: 인라인 편집), W-14 ISP 점검 등에서 사용.
 */
export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** 좌측 패널 aria-label (nav/영역 목록 등) */
  leftLabel?: string;
  className?: string;
}

export function SplitPane({ left, right, leftLabel = "목록", className }: SplitPaneProps) {
  return (
    <div
      data-slot="split-pane"
      className={cn("grid min-w-[1024px] grid-cols-[300px_1fr] gap-0", className)}
    >
      <div
        aria-label={leftLabel}
        className="min-h-0 overflow-y-auto border-r border-border"
      >
        {left}
      </div>
      <div className="min-h-0 overflow-y-auto">{right}</div>
    </div>
  );
}
