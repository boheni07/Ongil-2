import type { EmergencyInfoInput } from "@ongil/validation";
import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { RecordTimelineCard } from "@/components/timeline/RecordTimelineCard";
import { MilestoneCard } from "@/components/timeline/MilestoneCard";
import { PinnedCard } from "@/components/timeline/PinnedCard";

/**
 * docs/03-uiux.md §6-2·§8 스트림 뷰 — 날짜 내림차순 카드 리스트.
 * 순서: PinnedCard(응급정보) → isPinned 레코드 → 나머지(밀스톤은 MilestoneCard).
 * emergencyInfo가 주어질 때만 PinnedCard를 렌더한다 — 호출부가 넘기지 않으면(undefined) 카드 자체가 숨는다.
 * 보호자(G-10) 외에 특수교사·사회복지사·치료사(T-20/W-20/TH-20)도 넘긴다(2026-07-19 확장).
 */
export function TimelineStream({
  items,
  personName,
  emergencyInfo,
}: {
  items: TimelineItem[];
  personName: string;
  emergencyInfo?: EmergencyInfoInput | null;
}) {
  const pinnedRecords = items.filter((it) => it.isPinned);
  const rest = items.filter((it) => !it.isPinned);

  return (
    <div className="mt-6 flex flex-col gap-3">
      {emergencyInfo !== undefined && (
        <PinnedCard emergencyInfo={emergencyInfo ?? null} personName={personName} />
      )}
      {pinnedRecords.map((it) => (
        <Card key={it.id} item={it} />
      ))}
      <ul className="flex flex-col gap-3">
        {rest.map((it) => (
          <li key={it.id}>
            <Card item={it} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ item }: { item: TimelineItem }) {
  return item.isMilestone ? <MilestoneCard item={item} /> : <RecordTimelineCard item={item} />;
}
