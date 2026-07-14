import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DomainKey } from "@ongil/validation";
import { getPersonBirthDate, getTimeline, type TimelineItem } from "../lib/isp";
import { TimelineView } from "../components/timeline/TimelineView";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "WelTimeline">;

/**
 * W-20 복지 타임라인 — 데이터 조회(getTimeline, domain 무관 범용이라 lib/isp 재수출본 재사용)·
 * 필터 상태는 이 화면이 소유하고, 렌더는 공통 TimelineView(§6-2)에 위임한다.
 * 기본 진입은 복지(WEL) 도메인 필터(사회복지사 맥락).
 */
export function WelTimelineScreen({ route }: Props) {
  const { personId, personName } = route.params;

  const [filter, setFilter] = useState<DomainKey | "ALL">("WEL");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined);

  // 생년월일은 한 번만 조회(생애주기 배지·단계 필터·14/18세 구분선용, 필터와 무관).
  useEffect(() => {
    let alive = true;
    void (async () => {
      const b = await getPersonBirthDate(personId);
      if (alive) setBirthDate(b || undefined);
    })();
    return () => {
      alive = false;
    };
  }, [personId]);

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
      title="복지 타임라인"
      personName={personName}
      items={items}
      loading={loading}
      filter={filter}
      onFilterChange={setFilter}
      birthDate={birthDate}
    />
  );
}
