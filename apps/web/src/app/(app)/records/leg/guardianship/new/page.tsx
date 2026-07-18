import { getLegClients } from "@/app/(app)/records/leg/actions";
import { GuardianshipReportWizard } from "@/components/social-worker/GuardianshipReportWizard";

/** W-18 후견감독보고서(LEG-001) 작성. searchParams.personId로 특정 당사자를 미리 선택할 수 있다. */
export default async function NewGuardianshipReportPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getLegClients();
  return <GuardianshipReportWizard clients={clients} initialPersonId={personId} />;
}
