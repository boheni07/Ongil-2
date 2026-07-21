import { redirect } from "next/navigation";
import { getJournalDraft, getSupporterJournals } from "@/app/(app)/journal/actions";
import { JournalWizard, type JournalPersonOption } from "@/components/supporter/JournalWizard";

/**
 * S-12 임시저장 일지 이어서 작성(2026-07-21) — draft가 아니면(이미 제출 확정됐거나 없음)
 * 상세 화면으로 돌려보낸다. persons 목록은 /journals/new와 동일하게 작성 이력에서 파생한다.
 */
export default async function EditJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const draft = await getJournalDraft(id);
  if (!draft) redirect(`/journals/${id}`);

  const journals = await getSupporterJournals(50);
  const seen = new Map<string, JournalPersonOption>();
  for (const j of journals) {
    if (!seen.has(j.personId)) {
      seen.set(j.personId, { id: j.personId, name: j.personName ?? "이용자" });
    }
  }

  return <JournalWizard persons={[...seen.values()]} existing={draft} />;
}
