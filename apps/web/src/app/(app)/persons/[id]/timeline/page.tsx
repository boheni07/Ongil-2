import { notFound } from "next/navigation";
import type { EmergencyInfoInput } from "@ongil/validation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { getTimeline } from "@/app/(app)/records/iep/actions";
import { TimelineView } from "@/components/timeline/TimelineView";

/**
 * G-10 생애주기 타임라인(보호자) — docs/02-ia.md `/persons/:id/timeline`.
 * getGuardianPersons로 접근 권한 확인 겸 이름·응급정보를 얻고, getTimeline(id)로 기록을 조회한다.
 * 다른 역할의 공용 /timeline과 달리 여기서만 PinnedCard(응급정보)가 노출된다.
 */
export default async function GuardianTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  const items = await getTimeline(id);
  const emergencyInfo = (person.emergencyInfo ?? null) as EmergencyInfoInput | null;

  return (
    <TimelineView
      items={items}
      personName={person.fullName}
      emergencyInfo={emergencyInfo}
      birthDate={person.birthDate}
      personId={id}
    />
  );
}
