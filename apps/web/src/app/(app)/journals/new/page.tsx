import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupporterJournals } from "@/app/(app)/journal/actions";
import { JournalWizard, type JournalPersonOption } from "@/components/supporter/JournalWizard";

/**
 * S-12 활동일지 작성. 담당 이용자 목록은 별도 조회 API가 없어 기존 일지에 등장한 이용자에서
 * 파생한다(getSupporterJournals distinct). 새 지원사(일지 이력 없음)는 빈 목록 안내를 본다.
 */
export default async function NewJournalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const journals = await getSupporterJournals(50);
  const seen = new Map<string, JournalPersonOption>();
  for (const j of journals) {
    if (!seen.has(j.personId)) {
      seen.set(j.personId, { id: j.personId, name: j.personName ?? "이용자" });
    }
  }

  return <JournalWizard persons={[...seen.values()]} />;
}
