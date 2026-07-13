import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DomainKey } from "@ongil/validation";
import { getTimeline, type TimelineItem } from "../lib/therapy";
import { TimelineView } from "../components/timeline/TimelineView";
import type { TherapistStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TherapistStackParamList, "MedTimeline">;

/**
 * TH-20 치료 타임라인 — 데이터 조회(getTimeline, domain 무관 범용이라 lib/therapy 재수출본 재사용)·
 * 필터 상태는 이 화면이 소유하고, 렌더는 공통 TimelineView(§6-2)에 위임한다.
 * 기본 진입은 의료(MED) 도메인 필터(치료사 맥락).
 */
export function MedTimelineScreen({ route }: Props) {
  const { personId, personName } = route.params;

  const [filter, setFilter] = useState<DomainKey | "ALL">("MED");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TimelineItem[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      const data = await getTimeline(personId, filter === "ALL" ? undefined : filter);
      if (alive) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [personId, filter]);

  return (
    <TimelineView
      title="치료 타임라인"
      personName={personName}
      items={items}
      loading={loading}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
