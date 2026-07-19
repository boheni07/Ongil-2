import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { PersonRegisterWizard } from "@/components/guardian/PersonRegisterWizard";

/** 당사자 정보 수정(2026-07-19) — PersonRegisterWizard의 편집 모드. 보호자 전용. */
export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  return <PersonRegisterWizard existing={person} />;
}
