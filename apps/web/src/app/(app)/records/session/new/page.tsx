import Link from "next/link";
import {
  getTherapistClients,
  getSessionComposeContext,
} from "@/app/(app)/records/therapy/actions";
import { SessionNoteForm } from "@/components/therapist/SessionNoteForm";
import { computeAge } from "@/lib/lifecycle";

/**
 * TH-15 회기 일지 작성. searchParams.personId가 있으면 getSessionComposeContext로 계획서를
 * 자동 연결해 폼을 그린다. 없으면 담당 아동 선택 화면을 보여준다(진입 시점에 대상이 확정돼야
 * 자동연결 컨텍스트를 미리 조회할 수 있기 때문).
 */
export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getTherapistClients();

  if (!personId) {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className="text-headline-2 font-extrabold text-foreground">회기 일지 작성</h1>
        <p className="mt-1 text-body text-muted-foreground">회기 일지를 작성할 아동을 선택하세요.</p>
        {clients.length === 0 ? (
          <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
            담당 아동이 없습니다.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {clients.map((c) => (
              <li key={c.personId}>
                <Link
                  href={`/records/session/new?personId=${c.personId}`}
                  className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
                >
                  <span className="text-body font-semibold text-foreground">
                    {c.fullName}{" "}
                    <span className="text-caption font-medium text-muted-foreground">
                      만 {computeAge(c.birthDate)}세
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const context = await getSessionComposeContext(personId);
  const client = clients.find((c) => c.personId === personId) ?? null;

  return (
    <SessionNoteForm
      personId={personId}
      personName={client?.fullName ?? "아동"}
      context={context}
    />
  );
}
