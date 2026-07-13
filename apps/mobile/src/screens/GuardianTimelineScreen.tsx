import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DomainKey, EmergencyInfoInput } from "@ongil/validation";
import { getTimeline, type TimelineItem } from "../lib/iep";
import { getGuardianPersons } from "../lib/guardian";
import { TimelineView } from "../components/timeline/TimelineView";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "Timeline">;

/**
 * G-10 당사자 생애주기 타임라인(보호자) — 신규. 응급 대응 정보(PinnedCard)를 최상단에 노출하는
 * 유일한 진입점이다. emergency_info는 getGuardianPersons()에서 해당 당사자를 찾아 조회하고,
 * 기록은 getTimeline(personId)로 조회한다. 렌더는 공통 TimelineView(§6-2)에 위임한다.
 *
 * 보호자는 전 도메인을 조망하므로 기본 필터는 "전체(ALL)". 필터 변경 시 서버측 domain 필터로
 * 재조회한다(전문가 타임라인 3종과 동일 동작). emergencyInfo를 항상 넘겨 PinnedCard를 노출한다.
 */
export function GuardianTimelineScreen({ route }: Props) {
  const { personId, personName } = route.params;

  const [filter, setFilter] = useState<DomainKey | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [emergencyInfo, setEmergencyInfo] = useState<EmergencyInfoInput | null>(null);

  // 응급정보는 한 번만 조회(당사자 프로필 기준, 필터와 무관).
  useEffect(() => {
    let alive = true;
    void (async () => {
      const persons = await getGuardianPersons();
      const me = persons.find((p) => p.id === personId) ?? null;
      if (alive) {
        setEmergencyInfo((me?.emergencyInfo as EmergencyInfoInput | null) ?? null);
      }
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
      title="생애주기 타임라인"
      personName={personName}
      items={items}
      loading={loading}
      filter={filter}
      onFilterChange={setFilter}
      emergencyInfo={emergencyInfo}
    />
  );
}
