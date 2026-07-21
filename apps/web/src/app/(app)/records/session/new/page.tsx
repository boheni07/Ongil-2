import Link from "next/link";
import {
  getTherapistClients,
  getSessionComposeContext,
} from "@/app/(app)/records/therapy/actions";
import { SessionNoteForm } from "@/components/therapist/SessionNoteForm";
import { computeAge } from "@/lib/lifecycle";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MiniStat } from "@/components/therapist/TherapistHome";

/**
 * TH-15 회기 일지 작성. searchParams.personId가 있으면 getSessionComposeContext로 계획서를
 * 자동 연결해 폼을 그린다. 없으면 담당 당사자 선택 화면을 보여준다(진입 시점에 대상이 확정돼야
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
        <p className="mt-1 text-body text-muted-foreground">회기 일지를 작성할 당사자를 선택하세요.</p>
        {clients.length === 0 ? (
          <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
            담당 당사자가 없습니다.
          </p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <Link
                key={c.personId}
                href={`/records/session/new?personId=${c.personId}`}
                className="rounded-xl border-2 border-border bg-white p-4 text-left shadow-md transition-colors hover:border-primary-400"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="lg" className="bg-domain-med-bg">
                    {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
                    <AvatarFallback aria-hidden="true" className="bg-domain-med-bg text-2xl">
                      🧑
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="truncate text-body font-bold text-foreground">{c.fullName}</h3>
                    <p className="text-caption text-muted-foreground">만 {computeAge(c.birthDate)}세</p>
                    <div className="mt-1">
                      <StageBadge lifeStage={c.lifeStage} className="min-h-6 pr-2 text-[11px]" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <MiniStat n={c.planGoalCount} label="치료 목표" />
                  <MiniStat n={c.sessionCount} label="진행 회기" />
                </div>

                {!c.latestPlanRecordId && (
                  <p className="mt-2 rounded-(--br-sm) bg-accent-amber/20 px-2.5 py-1.5 text-caption font-semibold text-[#B56F10]">
                    ⚠️ 치료계획서 미작성 — 회기 자동연결 불가
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const context = await getSessionComposeContext(personId);
  const client = clients.find((c) => c.personId === personId) ?? null;

  return (
    <SessionNoteForm
      personId={personId}
      personName={client?.fullName ?? "당사자"}
      context={context}
    />
  );
}
