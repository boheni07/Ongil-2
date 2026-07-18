import { getCaseNoteClients } from "@/app/(app)/records/case-notes/actions";
import { CaseConferenceForm } from "@/components/social-worker/CaseConferenceForm";

/** W-23 사례회의록(WEL-006) 작성 — 단일 폼. */
export default async function NewCaseNotePage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getCaseNoteClients();
  return <CaseConferenceForm clients={clients} initialPersonId={personId} />;
}
