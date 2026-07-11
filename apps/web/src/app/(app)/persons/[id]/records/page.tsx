import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { getPersonRecords } from "./actions";
import { RecordManager } from "@/components/guardian/RecordManager";

/**
 * G-20 기록 관리 — 프로토타입 web-guardian.html 455~523줄.
 */
export default async function RecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  const items = await getPersonRecords(id);

  return <RecordManager personId={id} personName={person.fullName} initialItems={items} />;
}
