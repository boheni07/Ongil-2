import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { PermissionGrantWizard } from "@/components/guardian/PermissionGrantWizard";

/**
 * G-32 권한 부여 위저드 진입 — personId 컨텍스트를 확인하고 4단계 클라이언트 위저드를 렌더.
 * 프로토타입 web-guardian.html 601~674줄.
 */
export default async function GrantPermissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  return <PermissionGrantWizard personId={id} personName={person.fullName} />;
}
