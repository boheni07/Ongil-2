import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { getAccessLogs } from "./actions";
import { AccessLogViewer } from "@/components/guardian/AccessLogViewer";

/**
 * G-40 접근 로그 — 누가·언제·어떤 기록에 접근했는지 조회. 역할·도메인·날짜 필터 + 무한 스크롤.
 * docs/02-ia.md §3-3 /persons/:id/access-logs, 프로토타입 web-guardian.html 676~701줄.
 */
export default async function AccessLogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  const initialPage = await getAccessLogs(id, {});

  return (
    <AccessLogViewer personId={id} personName={person.fullName} initialPage={initialPage} />
  );
}
