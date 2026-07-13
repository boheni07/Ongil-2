import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupporterJournals } from "@/app/(app)/journal/actions";
import { HandoverForm, type HandoverPersonOption } from "@/components/handover/HandoverForm";

/**
 * S-21 인수인계 작성. docs/02-ia.md `/handovers/new`.
 * 담당 이용자 목록은 별도 조회 API가 없어 S-12와 동일하게 기존 일지에 등장한 이용자에서
 * 파생한다(getSupporterJournals distinct).
 */
export default async function NewHandoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const journals = await getSupporterJournals(50);
  const seen = new Map<string, HandoverPersonOption>();
  for (const j of journals) {
    if (!seen.has(j.personId)) {
      seen.set(j.personId, { id: j.personId, name: j.personName ?? "이용자" });
    }
  }

  return <HandoverForm persons={[...seen.values()]} />;
}
