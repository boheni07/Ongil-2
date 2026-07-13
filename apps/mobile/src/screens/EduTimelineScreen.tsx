import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DomainKey } from "@ongil/validation";
import { getTimeline, type TimelineItem } from "../lib/iep";
import { TimelineView } from "../components/timeline/TimelineView";
import type { TeacherStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TeacherStackParamList, "EduTimeline">;

/**
 * T-20 교육 타임라인 — 데이터 조회(getTimeline)·필터 상태는 이 화면이 소유하고, 렌더는 공통
 * TimelineView(§6-2)에 위임한다. 기본 진입은 교육(EDU) 도메인 필터(특수교사 맥락).
 * 필터 변경 시 서버측 domain 필터로 재조회하는 기존 동작을 그대로 유지한다.
 */
export function EduTimelineScreen({ route }: Props) {
  const { personId, personName } = route.params;

  const [filter, setFilter] = useState<DomainKey | "ALL">("EDU");
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
      title="교육 타임라인"
      personName={personName}
      items={items}
      loading={loading}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
