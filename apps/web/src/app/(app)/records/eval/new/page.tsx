import { getTherapistClients } from "@/app/(app)/records/therapy/actions";
import { EvalReportForm } from "@/components/therapist/EvalReportForm";

/** TH-17 평가보고서 작성. searchParams.personId로 특정 당사자를 미리 선택할 수 있다. */
export default async function NewEvalReportPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getTherapistClients();
  return <EvalReportForm clients={clients} initialPersonId={personId} />;
}
