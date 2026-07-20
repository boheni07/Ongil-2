import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { RecordTimelineCard } from "@/components/timeline/RecordTimelineCard";
import { MilestoneCard } from "@/components/timeline/MilestoneCard";
import { StageBadge, type LifeStage } from "@/components/lifecycle/StageBadge";
import { computeLifeStage } from "@/lib/lifecycle";

/**
 * docs/03-uiux.md §6-2·§8 스트림 뷰 — 날짜 내림차순 카드 리스트.
 * 순서: isPinned 레코드 → 나머지(밀스톤은 MilestoneCard). 응급정보(PinnedCard)는 2026-07-20부터
 * 이 목록과 분리해 `TimelineView`가 상단에 별도로 렌더한다(스크롤·필터와 무관하게 항상 보이도록).
 *
 * 2026-07-20: `birthDate`가 있으면 "나머지" 목록을 생애주기 단계별 섹션으로 묶는다(가장 최근에
 * 등장한 단계가 먼저 — 목록 자체는 이미 날짜 내림차순이라 각 단계가 처음 등장하는 순서를 그대로
 * 쓰면 자연스럽게 최신 단계부터 나온다). `onSelect`가 있으면 카드가 클릭 가능한 버튼이 되어
 * 우측 상세 패널(RecordDetailPane)과 연동한다(선택된 카드는 `selectedId`로 강조).
 */
export function TimelineStream({
  items,
  birthDate,
  selectedId,
  onSelect,
}: {
  items: TimelineItem[];
  birthDate?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const pinnedRecords = items.filter((it) => it.isPinned);
  const rest = items.filter((it) => !it.isPinned);

  const groups: { stage: LifeStage | null; items: TimelineItem[] }[] = [];
  if (birthDate) {
    const byStage = new Map<LifeStage, TimelineItem[]>();
    for (const it of rest) {
      const stage = computeLifeStage(birthDate, new Date(it.date));
      if (!byStage.has(stage)) byStage.set(stage, []);
      byStage.get(stage)!.push(it);
    }
    for (const [stage, stageItems] of byStage) groups.push({ stage, items: stageItems });
  } else {
    groups.push({ stage: null, items: rest });
  }

  return (
    <div className="flex flex-col">
      {pinnedRecords.map((it) => (
        <Card key={it.id} item={it} selected={it.id === selectedId} onSelect={onSelect} />
      ))}
      {groups.map((g, gi) => (
        <div key={g.stage ?? gi} className="flex flex-col">
          {g.stage && (
            <div className="mt-3 mb-1 flex items-center gap-2 px-1">
              <StageBadge lifeStage={g.stage} interactive={false} />
              <span className="text-caption text-muted-foreground">{g.items.length}건</span>
            </div>
          )}
          <ul className="flex flex-col">
            {g.items.map((it) => (
              <li key={it.id}>
                <Card item={it} selected={it.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * 기본 기록은 RecordManager 좌측 목록과 동일한 2줄 행(RecordTimelineCard)으로, 이정표는
 * 계속 존재감 있는 카드(MilestoneCard)로 구분한다 — 밀도를 맞추되 "이정표"의 시각적 강조는
 * 유지한다.
 */
function Card({
  item,
  selected,
  onSelect,
}: {
  item: TimelineItem;
  selected: boolean;
  onSelect?: (id: string) => void;
}) {
  if (item.isMilestone) {
    const body = <MilestoneCard item={item} />;
    if (!onSelect) return <div className="my-2 px-1">{body}</div>;
    return (
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={selected ? "true" : undefined}
        className={`my-2 block w-full rounded-xl px-1 text-left outline-none transition-shadow ${
          selected ? "ring-2 ring-primary-600" : "focus-visible:ring-2 focus-visible:ring-primary-600"
        }`}
      >
        {body}
      </button>
    );
  }

  const body = <RecordTimelineCard item={item} selected={selected} />;
  if (!onSelect) return body;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={selected ? "true" : undefined}
      className="block w-full text-left outline-none"
    >
      {body}
    </button>
  );
}
