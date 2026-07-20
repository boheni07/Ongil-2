import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { formatTimelineDate } from "@/components/timeline/format";

/**
 * docs/03-uiux.md §6-2 `RecordTimelineCard` — 2026-07-20부터 기록관리(RecordManager) 좌측
 * 목록과 동일한 2줄 행 스타일로 통일(제목·도메인·임시저장 배지 1줄 + 작성자·날짜·태그 1줄) —
 * 스트림 뷰가 RecordManager와 같은 좌(목록)·우(상세) 분할 구조가 되면서 목록 밀도도 맞췄다.
 * `isPinned`이면 좌측에 색상 마커를 붙여 고정 기록임을 표시한다(PinnedCard와는 별개 —
 * PinnedCard는 당사자 프로필의 응급정보, 이건 개별 레코드의 `records.is_pinned` 표시).
 * `isMilestone`인 항목은 상위(TimelineStream)에서 MilestoneCard로 분기하므로 여기선 다루지 않는다.
 */
export function RecordTimelineCard({ item, selected }: { item: TimelineItem; selected?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors ${
        selected ? "bg-primary-50" : "hover:bg-muted"
      } ${item.isPinned ? "border-l-4 border-l-domain-med-accent pl-3" : ""}`}
    >
      <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
        {item.isPinned && (
          <span aria-hidden="true" className="text-[13px]">
            📌
          </span>
        )}
        {item.title}
        <DomainChip domain={item.domain} />
        {item.isDraft && (
          <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
            임시저장
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
        {item.authorName ?? "알 수 없음"} · {formatTimelineDate(item.date)}
        {item.tags.map((t) => (
          <span key={t} className="rounded-(--br-sm) bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">
            {t}
          </span>
        ))}
      </span>
    </div>
  );
}
