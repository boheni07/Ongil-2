import { getTherapistClients } from "@/app/(app)/records/therapy/actions";
import { TherapyPlanWizard } from "@/components/therapist/TherapyPlanWizard";

/** TH-13 치료계획서 작성. searchParams.personId로 특정 아동을 미리 선택할 수 있다. */
export default async function NewTherapyPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getTherapistClients();
  return <TherapyPlanWizard clients={clients} initialPersonId={personId} />;
}
