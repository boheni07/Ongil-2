import type { DomainKey } from "@ongil/shared";
import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { formatTimelineDate } from "@/components/timeline/format";

/**
 * docs/03-uiux.md §6-2 `TimelineLane` — `repeat(6, 1fr)` CSS Grid, 도메인 병렬 레인(레인 뷰).
 * 등장하는 도메인만 컬럼으로 렌더한다(기존 EduTimeline.LaneView 로직 이관).
 * birthDate가 있으면 단계 전환 시점(만 6·13·19·65세 생일)이 두 기록 사이에 놓일 때
 * 그 사이에 전환 구분선을 삽입한다(docs/02-ia.md §3-9, 생애주기 5단계).
 */
const DOMAIN_ORDER: DomainKey[] = ["MED", "EDU", "WEL", "DAI", "TRA", "LEG"];

interface Threshold {
  time: number;
  label: string;
}

/** birthDate + n번째 생일의 timestamp. */
function birthdayTime(birthDate: string, years: number): number {
  const b = new Date(birthDate);
  return new Date(b.getFullYear() + years, b.getMonth(), b.getDate()).getTime();
}

type LaneEntry = { kind: "item"; item: TimelineItem } | { kind: "divider"; label: string };

/**
 * 날짜 내림차순 laneItems 사이에 전환 구분선을 끼워 넣는다.
 * 두 인접 기록(newer, older) 사이에 threshold가 놓이면(older.date < threshold <= newer.date)
 * 그 위치에 라벨을 삽입한다. 최신 기록보다 이후이거나 가장 오래된 기록보다 이전인 전환은
 * "두 기록 사이"가 아니므로 표시하지 않는다.
 */
function buildLaneEntries(laneItems: TimelineItem[], thresholds: Threshold[]): LaneEntry[] {
  const entries: LaneEntry[] = [];
  for (let i = 0; i < laneItems.length; i++) {
    const cur = new Date(laneItems[i].date).getTime();
    if (i > 0) {
      const prev = new Date(laneItems[i - 1].date).getTime();
      // 최신→과거 순서라 prev >= cur. 그 사이(내림차순)에 놓인 전환을 최신부터 삽입.
      for (const t of thresholds) {
        if (t.time > cur && t.time <= prev) {
          entries.push({ kind: "divider", label: t.label });
        }
      }
    }
    entries.push({ kind: "item", item: laneItems[i] });
  }
  return entries;
}

export function TimelineLane({
  items,
  birthDate,
}: {
  items: TimelineItem[];
  birthDate?: string;
}) {
  const lanes = DOMAIN_ORDER.filter((d) => items.some((it) => it.domain === d));

  // 전환 구분선은 두 기록 사이에 끼우므로 최신(큰 time)이 먼저 오도록 내림차순 정렬한다.
  const thresholds: Threshold[] = birthDate
    ? [
        { time: birthdayTime(birthDate, 65), label: "노년기 진입" },
        { time: birthdayTime(birthDate, 19), label: "성인기 진입" },
        { time: birthdayTime(birthDate, 13), label: "청소년 전환기 진입" },
        { time: birthdayTime(birthDate, 6), label: "아동기 진입" },
      ]
    : [];

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
          const entries = buildLaneEntries(laneItems, thresholds);
          return (
            <div key={d} className="flex flex-col gap-2">
              <div className="sticky top-0">
                <DomainChip domain={d} className="h-7 text-body" />
              </div>
              {entries.map((entry, idx) =>
                entry.kind === "divider" ? (
                  <div
                    key={`divider-${idx}`}
                    className="flex items-center gap-2 py-1"
                    role="separator"
                    aria-label={entry.label}
                  >
                    <span aria-hidden="true" className="h-px flex-1 bg-domain-tra-accent" />
                    <span className="rounded-(--br-sm) bg-domain-tra-bg px-2 py-0.5 text-caption font-bold text-domain-tra-text">
                      {entry.label}
                    </span>
                    <span aria-hidden="true" className="h-px flex-1 bg-domain-tra-accent" />
                  </div>
                ) : (
                  <div
                    key={entry.item.id}
                    className="rounded-(--br-md) bg-white p-3 ring-1 ring-foreground/10"
                  >
                    <div className="text-caption font-semibold text-muted-foreground">
                      {formatTimelineDate(entry.item.date).slice(5)}
                    </div>
                    <div className="mt-0.5 text-body font-semibold text-foreground">
                      {entry.item.title}
                      {entry.item.isMilestone && <span className="text-accent-amber"> ◆</span>}
                    </div>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
