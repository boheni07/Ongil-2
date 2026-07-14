import { getTransitionPlanClients } from "@/app/(app)/records/transition/actions";
import { TransitionPlanWizard } from "@/components/social-worker/TransitionPlanWizard";

/** W-16 전환계획 작성. searchParams.personId로 특정 당사자를 미리 선택할 수 있다. */
export default async function NewTransitionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getTransitionPlanClients();
  return <TransitionPlanWizard clients={clients} initialPersonId={personId} />;
}
