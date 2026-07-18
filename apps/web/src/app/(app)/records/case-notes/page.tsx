import { getCaseNoteClients } from "@/app/(app)/records/case-notes/actions";
import { CaseNotesBoard } from "@/components/social-worker/CaseNotesBoard";

/** W-22 사례회의록(WEL-006) 목록 — LegRecordsBoard와 동일 구조. */
export default async function CaseNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getCaseNoteClients();
  return <CaseNotesBoard clients={clients} initialPersonId={personId} />;
}
