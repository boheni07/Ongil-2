import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { RecordForm } from "@/components/guardian/RecordForm";

/** G-21 신규 기록 작성. */
export default async function NewRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  return <RecordForm personId={id} personName={person.fullName} existing={null} />;
}
