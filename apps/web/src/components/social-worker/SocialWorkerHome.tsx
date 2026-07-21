import Link from "next/link";
import {
  getSocialWorkerClients,
  getSocialWorkerWeeklyStats,
  getServiceUsageNextReviewDates,
} from "@/app/(app)/records/isp/actions";
import { getTransitionPlanClients } from "@/app/(app)/records/transition/actions";
import { getLegClients } from "@/app/(app)/records/leg/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CaseManagementMenu } from "@/components/social-worker/CaseManagementMenu";
import { WeeklyTaskCard } from "@/components/records/WeeklyTaskCard";
import { ddayFrom, isWithinWeek, sortWeeklyTasks, type WeeklyTaskItem } from "@/lib/weekly-tasks";

/**
 * W-01 사회복지사 홈 — 담당 당사자 카드 목록(프로토타입 web-social-worker.html 212~279줄).
 * 담당 당사자·요약 카드는 getSocialWorkerClients()에서 파생 가능한 값만 계산한다.
 * "이번 주 서비스"·"전환계획 진행중"은 2026-07-19(docs/12 Wave C)에 getSocialWorkerWeeklyStats로
 * 추가했다 — 이전엔 산출 불가/범위 밖으로 두 KPI 다 빠져 있었다.
 * 재사정 D-30 경고 배지는 reassessmentDday(0~30)에서 노출한다(음수면 기한 초과 톤).
 * "이번 주 처리할 일"(docs/14 Wave W-2)은 ISP 재사정·서비스이용현황(WEL-005) 재검토·전환계획
 * (TRA-001) 재검토·후견감독보고서(LEG-001) 제출기한 4종을 통합한다 — 기존 TodayTasks(ISP만)를
 * 이 카드로 흡수했다(§2 토론 결론, WEL-005·LEG-001 마감일은 이전까지 홈 어디서도 안 쓰였음).
 */
export async function SocialWorkerHome({ userName }: { userName: string | null }) {
  const clients = await getSocialWorkerClients();
  const name = userName ?? "선생님";

  const total = clients.length;
  const reassessSoon = clients.filter(
    (c) => c.reassessmentDday != null && c.reassessmentDday <= 30
  ).length;
  const [{ transitionInProgress, weeklyRecordCount }, serviceUsageReviews, transitionClients, legClients] =
    await Promise.all([
      getSocialWorkerWeeklyStats(clients.map((c) => c.personId)),
      getServiceUsageNextReviewDates(),
      getTransitionPlanClients(),
      getLegClients(),
    ]);

  const weeklyTasks = sortWeeklyTasks([
    ...clients.flatMap((c): WeeklyTaskItem[] => {
      if (c.reassessmentDday == null || !isWithinWeek(c.reassessmentDday)) return [];
      return [
        {
          personId: c.personId,
          personName: c.fullName,
          recordType: "WEL-004",
          label: "ISP 재사정",
          dday: c.reassessmentDday,
          href: `/records/isp/new?personId=${c.personId}`,
        },
      ];
    }),
    ...serviceUsageReviews.flatMap((r): WeeklyTaskItem[] => {
      const dday = ddayFrom(r.nextReviewDate);
      if (dday == null || !isWithinWeek(dday)) return [];
      return [
        {
          personId: r.personId,
          personName: r.personName,
          recordType: "WEL-005",
          label: "서비스 이용현황 재검토",
          dday,
          href: `/records/service-status?personId=${r.personId}`,
        },
      ];
    }),
    ...transitionClients.flatMap((c): WeeklyTaskItem[] => {
      const dday = ddayFrom(c.latestPlan?.nextReviewDate);
      if (dday == null || !isWithinWeek(dday)) return [];
      return [
        {
          personId: c.personId,
          personName: c.fullName,
          recordType: "TRA-001",
          label: "전환계획 재검토",
          dday,
          href: `/records/transition/new?personId=${c.personId}`,
        },
      ];
    }),
    ...legClients.flatMap((c): WeeklyTaskItem[] => {
      const dday = ddayFrom(c.latestReportDue);
      if (dday == null || !isWithinWeek(dday)) return [];
      return [
        {
          personId: c.personId,
          personName: c.fullName,
          recordType: "LEG-001",
          label: "후견감독보고서 제출기한",
          dday,
          href: `/records/leg/guardianship/new?personId=${c.personId}`,
        },
      ];
    }),
  ]);

  // docs/02-ia.md §3-9: adult 대상은 '성인 서비스 전환 필요'가 우선이라 목록 맨 위로 정렬한다.
  // Array.prototype.sort는 안정 정렬이라 adult 아닌 대상은 기존 순서를 유지한다.
  const sortedClients = [...clients].sort(
    (a, b) => Number(b.lifeStage === "adult") - Number(a.lifeStage === "adult")
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">안녕하세요, {name}님</h1>
          <p className="mt-1 text-body text-muted-foreground">
            담당 당사자 {total}명 · 개인별지원계획을 점검하고 서비스 이용을 관리하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CaseManagementMenu />
          <Button
            variant="outline"
            render={<Link href="/records/transition/new" />}
            className="h-11 px-5 font-bold"
          >
            🧭 전환계획 작성
          </Button>
          <Button
            render={<Link href="/records/isp/new" />}
            className="h-11 bg-accent-amber px-5 font-bold text-accent-stone hover:bg-accent-amber/85"
          >
            ＋ 새 ISP 작성
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={String(total)} label="담당 당사자" />
        <Stat n={String(reassessSoon)} label="ISP 재사정 임박" />
        <Stat n={String(transitionInProgress)} label="전환계획 진행중" />
        <Stat n={String(weeklyRecordCount)} label="이번 주 서비스" />
      </div>

      <WeeklyTaskCard items={weeklyTasks} />

      <h2 className="mt-8 mb-3 text-headline-3 font-bold text-accent-stone">담당 당사자</h2>
      {total === 0 ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          아직 담당 당사자가 없습니다. 보호자가 복지(WEL) 도메인 권한을 부여하면 해당 당사자의 ISP와
          서비스 이용 현황을 관리할 수 있습니다.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedClients.map((c) => {
            const href = c.latestIspRecordId
              ? `/records/isp/${c.latestIspRecordId}/review`
              : `/records/isp/new?personId=${c.personId}`;
            return (
              <div
                key={c.personId}
                className="flex flex-col gap-3 rounded-xl border-t-4 border-domain-wel-accent bg-white p-4 ring-1 ring-foreground/10"
              >
                <Link href={href} className="flex flex-col gap-3 rounded-(--br-md) transition-colors hover:bg-primary-50">
                  <div className="flex items-center gap-3">
                    <Avatar size="lg" className="size-11 bg-domain-wel-bg">
                      {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
                      <AvatarFallback
                        aria-hidden="true"
                        className="bg-domain-wel-bg text-body font-bold text-domain-wel-text"
                      >
                        {c.fullName.slice(0, 2) || "당사자"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-body font-bold text-foreground">{c.fullName}</p>
                      <div className="mt-1">
                        <StageBadge
                          lifeStage={c.lifeStage}
                          interactive={false}
                          className="min-h-6 pr-2 text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  {c.lifeStage === "adult" && (
                    <p className="rounded-(--br-sm) bg-domain-tra-bg px-2.5 py-1.5 text-caption font-bold text-domain-tra-text">
                      🧑 성인 서비스 전환 필요
                    </p>
                  )}

                  <div className="flex gap-2">
                    <MiniStat n={c.ispGoalCount} label="ISP 목표" />
                    <MiniStat
                      n={c.ispAchievementAvg != null ? `${c.ispAchievementAvg}%` : "-"}
                      label="달성률"
                    />
                  </div>

                  {c.ispAchievementAvg != null && (
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-domain-wel-accent"
                        style={{ width: `${c.ispAchievementAvg}%` }}
                      />
                    </span>
                  )}

                  <ReassessmentNotice dday={c.reassessmentDday} />
                  {!c.latestIspRecordId && (
                    <p className="rounded-(--br-sm) bg-accent-amber/20 px-2.5 py-1.5 text-caption font-semibold text-[#B56F10]">
                      ＋ ISP 미작성 — 눌러서 작성하기
                    </p>
                  )}
                </Link>

                {/* Q-1(docs/13 워크숍): 당사자를 이미 고른 상태에서 타임라인을 다시
                    고르지 않도록 카드에서 바로 personId를 실어 보낸다. */}
                <div className="border-t border-border/60 pt-2.5">
                  <Link
                    href={`/timeline?personId=${c.personId}`}
                    className="block rounded-(--br-sm) bg-muted/60 py-1.5 text-center text-caption font-semibold text-accent-stone hover:bg-muted"
                  >
                    🕐 타임라인 보기
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

/**
 * 재사정 D-day 경고 — 0~30이면 "재사정 D-n"(경고), 음수면 "재사정 기한 초과"(더 강한 톤).
 * 31일 이상 남았거나 ISP가 없으면(null) 아무것도 렌더하지 않는다.
 */
export function ReassessmentNotice({ dday }: { dday: number | null }) {
  if (dday == null || dday > 30) return null;
  if (dday < 0) {
    return (
      <p className="rounded-(--br-sm) bg-domain-med-bg px-2.5 py-1.5 text-caption font-bold text-domain-med-text">
        ⚠ 재사정 기한 초과 ({Math.abs(dday)}일 지남)
      </p>
    );
  }
  return (
    <p className="rounded-(--br-sm) bg-domain-med-bg px-2.5 py-1.5 text-caption font-bold text-domain-med-text">
      ⚠ 재사정 D-{dday}
    </p>
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
      <span className="text-body font-extrabold text-domain-wel-text">{n}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}
