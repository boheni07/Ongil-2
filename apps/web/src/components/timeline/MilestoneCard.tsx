import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { formatTimelineDate } from "@/components/timeline/format";

/**
 * docs/03-uiux.md §6-2 `MilestoneCard` — 144px 높이, 황금 테두리(#FAC775), 이정표(◆).
 * `is_milestone=true` 항목에 RecordTimelineCard 대신 사용한다.
 */
export function MilestoneCard({ item }: { item: TimelineItem }) {
  return (
    <div
      className="flex min-h-36 flex-col justify-center rounded-xl bg-white p-4 ring-1 ring-foreground/10"
      style={{ border: "2px solid #FAC775" }}
    >
      <div className="text-caption font-semibold text-muted-foreground">
        {formatTimelineDate(item.date)}
      </div>
      <h4 className="mt-1 text-headline-3 font-extrabold text-foreground">{item.title}</h4>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <DomainChip domain={item.domain} />
        <span className="rounded-(--br-sm) bg-accent-amber/25 px-2 py-0.5 text-[12px] font-semibold text-[#B56F10]">
          ◆ 이정표
        </span>
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
