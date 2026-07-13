import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReceivedHandovers, getSentHandovers } from "@/app/(app)/handovers/actions";
import { HandoverTabs } from "@/components/handover/HandoverTabs";

/**
 * S-20 인수인계 목록(받은/보낸). docs/04-workflow.md Flow-S-02, docs/02-ia.md `/handovers`.
 * 받은 인계는 서버 액션이 미확인 우선 정렬해서 주므로 순서를 그대로 클라이언트에 넘긴다.
 */
export default async function HandoversPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [received, sent] = await Promise.all([getReceivedHandovers(), getSentHandovers()]);

  return <HandoverTabs received={received} sent={sent} />;
}
