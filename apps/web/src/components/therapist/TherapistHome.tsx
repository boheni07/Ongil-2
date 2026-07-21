import Link from "next/link";
import { getTherapistClients } from "@/app/(app)/records/therapy/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { computeAge } from "@/lib/lifecycle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BacklogTaskCard, type BacklogTaskItem } from "@/components/records/BacklogTaskCard";

/**
 * TH-01 치료사 홈 — 담당 당사자 카드 목록(프로토타입 web-therapist.html 203~223줄).
 * 프로토타입은 "오늘 회기 일정"이 중심이나 회기 스케줄 데이터가 없어(과잉 구현 금지)
 * getTherapistClients()에서 파생 가능한 값(담당 당사자 수·계획서 미작성 수·총 회기 수)만 KPI로 낸다.
 * T-01/W-01과 동일 구조를 MED 도메인 색상으로 이식한 것이다.
 * "처리 대기 중"(docs/14 Wave W-3)은 치료계획서 자체가 재검토일 필드를 스키마에 갖고 있지
 * 않아(§1 조사) 날짜 기반 카드 대신 "계획서 미작성 대상자" 백로그로 대체한다.
 */
export async function TherapistHome({ userName }: { userName: string | null }) {
  const clients = await getTherapistClients();
  const name = userName ?? "선생님";

  const total = clients.length;
  const planMissing = clients.filter((c) => !c.latestPlanRecordId).length;
  const sessionTotal = clients.reduce((sum, c) => sum + c.sessionCount, 0);
  const backlogItems: BacklogTaskItem[] = clients
    .filter((c) => !c.latestPlanRecordId)
    .map((c) => ({
      personId: c.personId,
      personName: c.fullName,
      label: "치료계획서 미작성",
      href: `/records/therapy-plan/new?personId=${c.personId}`,
    }));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">안녕하세요, {name}님</h1>
          <p className="mt-1 text-body text-muted-foreground">
            담당 당사자 {total}명 · 치료계획서를 점검하고 회기 일지를 남겨보세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            render={<Link href="/records/eval/new" />}
            variant="outline"
            className="h-11 px-5 font-bold"
          >
            ＋ 평가보고서 작성
          </Button>
          <Button
            render={<Link href="/records/session/new" />}
            className="h-11 bg-accent-amber px-5 font-bold text-accent-stone hover:bg-accent-amber/85"
          >
            ＋ 회기 일지 작성
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={String(total)} label="담당 당사자" />
        <Stat n={String(planMissing)} label="계획서 미작성" />
        <Stat n={String(sessionTotal)} label="누적 회기" />
        <Stat n="-" label="오늘 회기" />
      </div>

      <BacklogTaskCard
        title="📋 처리 대기 중"
        emptyText="처리 대기 중인 항목이 없습니다."
        items={backlogItems}
      />

      <h2 className="mt-8 mb-3 text-headline-3 font-bold text-accent-stone">담당 당사자</h2>
      {total === 0 ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          아직 담당 당사자가 없습니다. 보호자가 의료(MED) 도메인 권한을 부여하면 해당 당사자의 치료계획서와
          회기 일지를 남길 수 있습니다.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const href = c.latestPlanRecordId
              ? `/records/therapy-plan/${c.latestPlanRecordId}`
              : `/records/therapy-plan/new?personId=${c.personId}`;
            return (
              <div
                key={c.personId}
                className="flex flex-col gap-3 rounded-xl border-t-4 border-domain-med-accent bg-white p-4 ring-1 ring-foreground/10"
              >
                <Link href={href} className="flex flex-col gap-3 rounded-(--br-md) transition-colors hover:bg-primary-50">
                  <div className="flex items-center gap-3">
                    <Avatar size="lg" className="size-11 bg-domain-med-bg">
                      {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
                      <AvatarFallback
                        aria-hidden="true"
                        className="bg-domain-med-bg text-body font-bold text-domain-med-text"
                      >
                        {c.fullName.slice(0, 2) || "당사자"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-body font-bold text-foreground">
                        {c.fullName}{" "}
                        <span className="text-caption font-medium text-muted-foreground">
                          만 {computeAge(c.birthDate)}세
                        </span>
                      </p>
                      <div className="mt-1">
                        <StageBadge lifeStage={c.lifeStage} className="min-h-6 pr-2 text-[11px]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <MiniStat n={c.planGoalCount} label="치료 목표" />
                    <MiniStat n={c.sessionCount} label="진행 회기" />
                  </div>

                  {!c.latestPlanRecordId && (
                    <p className="rounded-(--br-sm) bg-accent-amber/20 px-2.5 py-1.5 text-caption font-semibold text-[#B56F10]">
                      ＋ 계획서 미작성 — 눌러서 작성하기
                    </p>
                  )}
                </Link>

                {/* Q-1(docs/13 워크숍): 당사자를 이미 고른 상태에서 회기 일지·타임라인을
                    다시 고르지 않도록 카드에서 바로 personId를 실어 보낸다. */}
                <div className="flex gap-2 border-t border-border/60 pt-2.5 text-caption">
                  <Link
                    href={`/records/session/new?personId=${c.personId}`}
                    className="flex-1 rounded-(--br-sm) bg-muted/60 py-1.5 text-center font-semibold text-accent-stone hover:bg-muted"
                  >
                    📝 회기 일지
                  </Link>
                  <Link
                    href={`/timeline?personId=${c.personId}`}
                    className="flex-1 rounded-(--br-sm) bg-muted/60 py-1.5 text-center font-semibold text-accent-stone hover:bg-muted"
                  >
                    🕐 타임라인
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-xl bg-white p-4 text-center ring-1 ring-foreground/10">
      <div className="text-2xl font-extrabold text-primary-700">{n}</div>
      <div className="mt-1 text-caption text-muted-foreground">{label}</div>
    </div>
  );
}

export function MiniStat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-(--br-md) bg-muted/50 py-2">
      <span className="text-body font-extrabold text-domain-med-text">{n}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}
