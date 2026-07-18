import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { ProxyExpressWizard } from "@/components/guardian/ProxyExpressWizard";

/**
 * G-22 보호자 대리 자기표현(SELF-001) — docs/07 §5 갭⑥.
 * 당사자를 대신해 보호자가 자기표현 기록을 남긴다. P-02 UI 재사용.
 */
export default async function ProxyExpressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  return <ProxyExpressWizard personId={id} personName={person.fullName} />;
}
