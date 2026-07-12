import { notFound } from "next/navigation";
import { getIepDetail } from "@/app/(app)/records/iep/actions";
import { IepReviewPane } from "@/components/teacher/IepReviewPane";

/** T-14 IEP 점검 Split Pane. id=IEP(EDU-001) 레코드 id. */
export default async function IepReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getIepDetail(id);
  if (!detail) notFound();
  return <IepReviewPane detail={detail} />;
}
