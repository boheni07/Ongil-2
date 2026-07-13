import type { DomainKey } from "@ongil/shared";
import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { formatTimelineDate } from "@/components/timeline/format";

/**
 * docs/03-uiux.md §6-2 `TimelineLane` — `repeat(6, 1fr)` CSS Grid, 도메인 병렬 레인(레인 뷰).
 * 등장하는 도메인만 컬럼으로 렌더한다(기존 EduTimeline.LaneView 로직 이관).
 */
const DOMAIN_ORDER: DomainKey[] = ["MED", "EDU", "WEL", "DAI", "TRA", "LEG"];

export function TimelineLane({ items }: { items: TimelineItem[] }) {
  const lanes = DOMAIN_ORDER.filter((d) => items.some((it) => it.domain === d));

  return (
    <div className="mt-6 overflow-x-auto">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${lanes.length}, minmax(14rem, 1fr))`,
          minWidth: `${lanes.length * 220}px`,
        }}
      >
        {lanes.map((d) => {
          const laneItems = items.filter((it) => it.domain === d);
          return (
            <div key={d} className="flex flex-col gap-2">
              <div className="sticky top-0">
                <DomainChip domain={d} className="h-7 text-body" />
              </div>
              {laneItems.map((it) => (
                <div
                  key={it.id}
                  className="rounded-(--br-md) bg-white p-3 ring-1 ring-foreground/10"
                >
                  <div className="text-caption font-semibold text-muted-foreground">
                    {formatTimelineDate(it.date).slice(5)}
                  </div>
                  <div className="mt-0.5 text-body font-semibold text-foreground">
                    {it.title}
                    {it.isMilestone && <span className="text-accent-amber"> ◆</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
