import Link from "next/link";
import type { BehaviorFunction } from "@ongil/validation";
import { getBipClients } from "@/app/(app)/records/bip/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

/**
 * T-15 행동중재계획(BIP) 목록·학생 선택 — 특수교사가 EDU write/edit 권한을 가진 학생 카드.
 * 각 카드는 최근 제출 BIP(행동 기능·재검토일·확인 상태) 요약을 보여주고 새 작성으로 유도한다.
 * 권한 프리셋상 EDU write가 없으면 getBipClients가 빈 배열을 반환한다(빈 상태 안내).
 */

const BEHAVIOR_FUNCTION_LABEL: Record<BehaviorFunction, string> = {
  attention: "관심획득",
  escape: "회피",
  sensory: "감각추구",
  other: "기타",
};

export default async function BipListPage() {
  const students = await getBipClients();
  const total = students.length;
  const missing = students.filter((s) => !s.latestBip).length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">행동중재계획(BIP)</h1>
          <p className="mt-1 text-body text-muted-foreground">
            담당 학생 {total}명 · 기능평가에 기반한 행동중재계획을 작성·점검하세요.
          </p>
        </div>
        <Button
          render={<Link href="/records/bip/new" />}
          className="h-11 bg-accent-amber px-5 font-bold text-accent-stone hover:bg-accent-amber/85"
        >
          ＋ 새 BIP 작성
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat n={String(total)} label="담당 학생" />
        <Stat n={String(missing)} label="BIP 미작성" />
        <Stat n={String(total - missing)} label="BIP 작성됨" />
      </div>

      <h2 className="mt-8 mb-3 text-headline-3 font-bold text-accent-stone">담당 학생</h2>
      {total === 0 ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          아직 담당 학생이 없습니다. 보호자가 교육(EDU) 도메인 작성 권한을 부여하면 해당 학생의
          행동중재계획을 작성할 수 있습니다.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => (
            <Link
              key={s.personId}
              href={`/records/bip/new?personId=${s.personId}`}
              className="flex flex-col gap-3 rounded-xl border-t-4 border-domain-edu-accent bg-white p-4 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
            >
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="size-11 bg-domain-edu-bg">
                  {s.avatarUrl ? <AvatarImage src={s.avatarUrl} alt="" /> : null}
                  <AvatarFallback
                    aria-hidden="true"
                    className="bg-domain-edu-bg text-body font-bold text-domain-edu-text"
                  >
                    {s.fullName.slice(0, 2) || "학생"}
                  </AvatarFallback>
                </Avatar>
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

              {s.latestBip ? (
                <div className="flex flex-col gap-1.5 rounded-(--br-md) bg-muted/50 p-3">
                  <span className="flex items-center gap-2 text-caption text-muted-foreground">
                    최근 행동 기능
                    <span className="font-bold text-domain-edu-text">
                      {s.latestBip.behaviorFunction
                        ? BEHAVIOR_FUNCTION_LABEL[s.latestBip.behaviorFunction]
                        : "-"}
                    </span>
                  </span>
                  <span className="text-caption text-muted-foreground">
                    재검토 예정일 {s.latestBip.reviewDate ?? "-"}
                  </span>
                  {s.latestBip.requiresConfirmation && (
                    <ConfirmBadge confirmedAt={s.latestBip.confirmedAt} />
                  )}
                </div>
              ) : (
                <p className="rounded-(--br-sm) bg-accent-amber/20 px-2.5 py-1.5 text-caption font-semibold text-[#B56F10]">
                  ＋ BIP 미작성 — 눌러서 작성하기
                </p>
              )}
            </Link>
          ))}
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
