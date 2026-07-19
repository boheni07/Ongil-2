import Link from "next/link";
import { getSocialWorkerClients, type SocialWorkerClient } from "@/app/(app)/records/isp/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { CaseManagementMenu } from "@/components/social-worker/CaseManagementMenu";

/**
 * W-01 사회복지사 홈 — 담당 당사자 카드 목록(프로토타입 web-social-worker.html 212~279줄).
 * 담당 당사자·요약 카드는 getSocialWorkerClients()에서 파생 가능한 값만 계산한다.
 * "이번 주 서비스"는 이 조회로 정확히 산출할 수 없어 "-"로 표시한다(과잉 구현 금지).
 * "전환계획 진행중"(TRA)은 이번 라운드 범위 밖이라 KPI에서 제외한다.
 * 재사정 D-30 경고 배지는 reassessmentDday(0~30)에서 노출한다(음수면 기한 초과 톤).
 */
export async function SocialWorkerHome({ userName }: { userName: string | null }) {
  const clients = await getSocialWorkerClients();
  const name = userName ?? "선생님";

  const total = clients.length;
  const ispMissing = clients.filter((c) => !c.latestIspRecordId).length;
  const reassessSoon = clients.filter(
    (c) => c.reassessmentDday != null && c.reassessmentDday <= 30
  ).length;

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

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat n={String(total)} label="담당 당사자" />
        <Stat n={String(reassessSoon)} label="ISP 재사정 임박" />
        <Stat n={String(ispMissing)} label="ISP 미작성" />
      </div>

      <TodayTasks
        clients={sortedClients.filter((c) => c.reassessmentDday != null && c.reassessmentDday <= 30)}
      />

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
              <Link
                key={c.personId}
                href={href}
                className="flex flex-col gap-3 rounded-xl border-t-4 border-domain-wel-accent bg-white p-4 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-domain-wel-bg text-body font-bold text-domain-wel-text"
                  >
                    {c.fullName.slice(0, 2) || "당사자"}
                  </span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * "오늘 할 일"(프로토타입 web-social-worker.html W-01, 271~275줄) — 프로토타입은 4종 예시를
 * 정적으로 나열하지만(재사정·전환계획 훈련기관 배정·서비스 이용 점검·인수인계 작성), 실제로
 * 산출 가능한 근거 데이터가 있는 건 ISP 재사정 임박/초과뿐이다(reassessmentDday, 이미
 * getSocialWorkerClients가 계산해 옴). 나머지 3종은 "훈련기관 미배정"·"서비스 점검 주기"를
 * 판정할 근거 필드 자체가 DB에 없어(별도 설계 필요), 가짜 목업 항목을 채워 넣는 대신 실제로
 * 근거 있는 항목만 보여준다 — 목록이 비면 섹션 자체를 숨긴다.
 */
function TodayTasks({ clients }: { clients: SocialWorkerClient[] }) {
  if (clients.length === 0) return null;
  return (
    <section className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
      <h3 className="mb-2 text-body font-bold text-accent-stone">오늘 할 일</h3>
      <ul className="flex flex-col">
        {clients.map((c) => (
          <li key={c.personId} className="border-b border-border/60 py-2.5 last:border-0">
            <Link
              href={
                c.latestIspRecordId
                  ? `/records/isp/${c.latestIspRecordId}/review`
                  : `/records/isp/new?personId=${c.personId}`
              }
              className="flex items-center gap-2.5 text-caption text-foreground hover:text-primary-700"
            >
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  (c.reassessmentDday ?? 0) < 0 ? "bg-red-500" : "bg-domain-med-accent"
                }`}
              />
              {c.fullName}{" "}
              {(c.reassessmentDday ?? 0) < 0
                ? `ISP 재사정 기한 초과 (${Math.abs(c.reassessmentDday ?? 0)}일 지남)`
                : `ISP 재사정 D-${c.reassessmentDday}`}
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
