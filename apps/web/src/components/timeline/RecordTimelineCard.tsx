import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { DraftBadge } from "@/components/timeline/DraftBadge";
import { formatTimelineDate } from "@/components/timeline/format";

/**
 * docs/03-uiux.md §6-2 `RecordTimelineCard` — 96px 높이 기본 카드.
 * 도메인 chip · 제목 · 날짜. `isDraft`면 오른쪽 상단 DraftBadge.
 * `isPinned`이면 좌측에 빨간 마커를 붙여 고정 기록임을 표시한다(PinnedCard와는 별개 —
 * PinnedCard는 당사자 프로필의 응급정보, 이건 개별 레코드의 `records.is_pinned` 표시).
 * `isMilestone`인 항목은 상위(TimelineStream)에서 MilestoneCard로 분기하므로 여기선 다루지 않는다.
 */
export function RecordTimelineCard({ item }: { item: TimelineItem }) {
  return (
    <div
      className={`relative flex min-h-24 flex-col justify-center rounded-xl bg-white p-4 ring-1 ring-foreground/10 ${
        item.isPinned ? "border-l-4 border-domain-med-accent pl-3.5" : ""
      }`}
    >
      {item.isPinned && (
        <span aria-hidden="true" className="absolute left-3 top-3 text-[13px]">
          📌
        </span>
      )}
      {item.isDraft && (
        <div className="absolute right-3 top-3">
          <DraftBadge />
        </div>
      )}
      <div className="text-caption font-semibold text-muted-foreground">
        {formatTimelineDate(item.date)}
      </div>
      <h4 className="mt-1 text-body font-bold text-foreground">{item.title}</h4>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <DomainChip domain={item.domain} />
        {item.tags.map((t) => (
          <span
            key={t}
            className="rounded-(--br-sm) bg-muted px-2 py-0.5 text-[12px] text-muted-foreground"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
