import { getSocialWorkerClients } from "@/app/(app)/records/isp/actions";
import { IspWizard } from "@/components/social-worker/IspWizard";

/** W-13 ISP 작성. searchParams.personId로 특정 당사자를 미리 선택할 수 있다. */
export default async function NewIspPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getSocialWorkerClients();
  return <IspWizard clients={clients} initialPersonId={personId} />;
}
