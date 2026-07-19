import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §6-2 `DraftBadge` — 오른쪽 상단 뱃지, `is_draft=true`일 때.
 * RecordManager.tsx에 인라인으로 있던 "임시저장" 뱃지를 컴포넌트로 승격(동일 스타일).
 */
export function DraftBadge({ className }: { className?: string }) {
  return (
    <span
      data-slot="draft-badge"
      className={cn(
        "shrink-0 whitespace-nowrap rounded-[4px] bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground",
        className
      )}
    >
      임시저장
    </span>
  );
}
