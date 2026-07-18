import { getItpClients } from "@/app/(app)/records/itp/actions";
import { ItpWizard } from "@/components/teacher/ItpWizard";

/** T-19 개별화전환계획(ITP) 작성. searchParams.personId로 특정 학생을 미리 선택할 수 있다. */
export default async function NewItpPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getItpClients();
  return <ItpWizard clients={clients} initialPersonId={personId} />;
}
