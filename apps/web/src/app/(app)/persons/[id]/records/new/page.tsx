import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { RecordTypePicker } from "@/components/guardian/RecordTypePicker";

/**
 * G-21 신규 기록 작성 — 각 분야 전용 서식(RecordTypePicker) 또는 자유 기록(RecordForm) 중
 * 선택한다(2026-07-19, 기존엔 자유 기록 하나뿐이었다).
 */
export default async function NewRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  return <RecordTypePicker personId={id} personName={person.fullName} />;
}
