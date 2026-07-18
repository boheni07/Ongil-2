import Link from "next/link";
import { getTeacherStudents } from "@/app/(app)/records/iep/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { isItpActiveStage, isPreTransitionStage } from "@/lib/lifecycle";

/**
 * T-01 특수교사 홈 — 담당 학생 카드 목록(프로토타입 web-teacher.html 245~285줄).
 * 담당 학생·요약 카드는 getTeacherStudents()에서 파생 가능한 값만 계산한다.
 * "이번 주 관찰기록"은 이 조회로 정확히 산출할 수 없어 "-"로 표시한다(과잉 구현 금지).
 */
export async function TeacherHome({ userName }: { userName: string | null }) {
  const students = await getTeacherStudents();
  const name = userName ?? "선생님";

  const total = students.length;
  const iepMissing = students.filter((s) => !s.latestIepRecordId).length;
  const transitionTargets = students.filter((s) => !isPreTransitionStage(s.lifeStage)).length;
  const itpTargets = students.filter((s) => isItpActiveStage(s.lifeStage)).length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">안녕하세요, {name}님</h1>
          <p className="mt-1 text-body text-muted-foreground">
            담당 학생 {total}명 · 개별화교육계획을 점검하고 관찰기록을 남겨보세요.
          </p>
        </div>
        <Button
          render={<Link href="/records/iep/new" />}
          className="h-11 bg-accent-amber px-5 font-bold text-accent-stone hover:bg-accent-amber/85"
        >
          ＋ 새 IEP 작성
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          render={<Link href="/records/bip" />}
          variant="outline"
          className="h-10 font-semibold"
        >
          🧩 행동중재계획(BIP)
        </Button>
        <Button
          render={<Link href="/records/observation/new" />}
          variant="outline"
          className="h-10 font-semibold"
        >
          📝 관찰기록 작성
        </Button>
        {transitionTargets > 0 && (
          <Button
            render={<Link href="/records/transition/new" />}
            variant="outline"
            className="h-10 font-semibold"
          >
            🔀 전환계획 작성 (만 13세+)
          </Button>
        )}
        {itpTargets > 0 && (
          <Button
            render={<Link href="/records/itp" />}
            variant="outline"
            className="h-10 font-semibold"
          >
            🎓 개별화전환계획(ITP)
          </Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={String(total)} label="담당 학생" />
        <Stat n={String(iepMissing)} label="IEP 미작성" />
        <Stat n="-" label="이번 주 관찰기록" />
        <Stat n={String(transitionTargets)} label="전환계획 대상" />
      </div>

      <h2 className="mt-8 mb-3 text-headline-3 font-bold text-accent-stone">담당 학생</h2>
      {total === 0 ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          아직 담당 학생이 없습니다. 보호자가 교육(EDU) 도메인 권한을 부여하면 해당 학생의 IEP와
          관찰기록을 남길 수 있습니다.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => {
            const href = s.latestIepRecordId
              ? `/records/iep/${s.latestIepRecordId}/review`
              : `/records/iep/new?personId=${s.personId}`;
            return (
              <Link
                key={s.personId}
                href={href}
                className="flex flex-col gap-3 rounded-xl border-t-4 border-domain-edu-accent bg-white p-4 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-domain-edu-bg text-body font-bold text-domain-edu-text"
                  >
                    {s.fullName.slice(0, 2) || "학생"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-body font-bold text-foreground">{s.fullName}</p>
                    <div className="mt-1">
                      <StageBadge
                        lifeStage={s.lifeStage}
                        interactive={false}
                        className="min-h-6 pr-2 text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <MiniStat n={s.iepGoalCount} label="IEP 목표" />
                  <MiniStat
                    n={s.iepAchievementAvg != null ? `${s.iepAchievementAvg}%` : "-"}
                    label="달성률"
                  />
                </div>

                {!isPreTransitionStage(s.lifeStage) && (
                  <p className="rounded-(--br-sm) bg-domain-tra-bg px-2.5 py-1.5 text-caption font-semibold text-domain-tra-text">
                    ⚠ 전환계획 수립 대상 (만 13세+)
                  </p>
                )}
                {!s.latestIepRecordId && (
                  <p className="rounded-(--br-sm) bg-accent-amber/20 px-2.5 py-1.5 text-caption font-semibold text-[#B56F10]">
                    ＋ IEP 미작성 — 눌러서 작성하기
                  </p>
                )}
              </Link>
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

function MiniStat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-(--br-md) bg-muted/50 py-2">
      <span className="text-body font-extrabold text-domain-edu-text">{n}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}
