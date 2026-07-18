import { getLegClients } from "@/app/(app)/records/leg/actions";
import { AdvocacyConsultationForm } from "@/components/social-worker/AdvocacyConsultationForm";

/** W-19 권익옹호 상담기록(LEG-002) 작성. searchParams.personId로 특정 당사자를 미리 선택할 수 있다. */
export default async function NewAdvocacyConsultationPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getLegClients();
  return <AdvocacyConsultationForm clients={clients} initialPersonId={personId} />;
}
