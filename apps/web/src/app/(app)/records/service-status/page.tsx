import { getServiceUsage } from "@/app/(app)/records/isp/actions";
import { ServiceUsageTable } from "@/components/social-worker/ServiceUsageTable";

/**
 * W-17 서비스 이용 현황(IA §3-7: /records/service-status).
 * 전체 행을 받아 클라이언트에서 상태별로 필터한다.
 * ?personId= 쿼리(2026-07-17 추가, ISP 점검 화면 W-14 연결 강화)가 있으면 해당 당사자로
 * 초기 필터해 진입한다 — docs/08-record-taxonomy-workshop.md §6 Wave1-3.
 */
export default async function ServiceStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const rows = await getServiceUsage();
  return <ServiceUsageTable rows={rows} initialPersonId={personId} />;
}
