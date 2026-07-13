import { getServiceUsage } from "@/app/(app)/records/isp/actions";
import { ServiceUsageTable } from "@/components/social-worker/ServiceUsageTable";

/**
 * W-17 서비스 이용 현황(IA §3-7: /records/service-status).
 * 전체 행을 받아 클라이언트에서 상태별로 필터한다.
 */
export default async function ServiceStatusPage() {
  const rows = await getServiceUsage();
  return <ServiceUsageTable rows={rows} />;
}
