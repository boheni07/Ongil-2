import { notFound } from "next/navigation";
import { getIspDetail } from "@/app/(app)/records/isp/actions";
import { IspReviewPane } from "@/components/social-worker/IspReviewPane";

/** W-14 ISP 점검 Split Pane. id=ISP(WEL-004) 레코드 id. */
export default async function IspReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getIspDetail(id);
  if (!detail) notFound();
  return <IspReviewPane detail={detail} />;
}
