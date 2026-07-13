import { notFound } from "next/navigation";
import { getTherapyPlanDetail } from "@/app/(app)/records/therapy/actions";
import { TherapyPlanDetail } from "@/components/therapist/TherapyPlanDetail";

/** TH-14 치료계획서 상세. id=치료계획서(MED-005) 레코드 id. */
export default async function TherapyPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getTherapyPlanDetail(id);
  if (!detail) notFound();
  return <TherapyPlanDetail detail={detail} />;
}
