import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { getRecordDetail } from "../../actions";
import { RecordForm } from "@/components/guardian/RecordForm";

/** G-21 기록 수정. */
export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  const existing = await getRecordDetail(recordId);
  if (!existing) notFound();

  return <RecordForm personId={id} personName={person.fullName} existing={existing} />;
}
