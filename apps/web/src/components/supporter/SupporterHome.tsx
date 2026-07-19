import Link from "next/link";
import { getSupporterJournals } from "@/app/(app)/journal/actions";
import { getReceivedHandovers } from "@/app/(app)/handovers/actions";
import { Button } from "@/components/ui/button";

/** "2시간 전"/"어제"/"3일 전" — 프로토타입 S-01 최근 인수인계 상대시간 표기(web-supporter.html). */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  return `${days}일 전`;
}

/**
 * S-01 활동지원사 홈 — 통계(작성 일지/임시저장) + 최근 일지 목록 + 최근 인수인계 + 일지 작성 CTA.
 * 방문 일정 시스템은 아직 없어 통계는 기존 일지 데이터에서 파생한다.
 */
export async function SupporterHome({ userName }: { userName: string | null }) {
  const [journals, handovers] = await Promise.all([
    getSupporterJournals(20),
    getReceivedHandovers(5),
  ]);
  const drafts = journals.filter((j) => j.isDraft).length;
  const submitted = journals.length - drafts;
  const name = userName ?? "지원사";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">안녕하세요, {name}님 👋</h1>
          <p className="mt-1 text-body text-muted-foreground">오늘도 좋은 하루 보내세요.</p>
        </div>
        <Button
          render={<Link href="/journals/new" />}
          className="h-11 bg-accent-amber px-5 font-bold text-accent-stone hover:bg-accent-amber/85"
        >
          ✍️ 일지 작성
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat n={journals.length} label="전체 일지" />
        <Stat n={submitted} label="제출 완료" />
        <Stat n={drafts} label="임시저장" />
      </div>

      <h2 className="mt-8 mb-3 text-headline-3 font-bold text-accent-stone">최근 일지</h2>
      {journals.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          아직 작성한 일지가 없습니다. 위 “일지 작성” 버튼으로 첫 일지를 남겨보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {journals.map((j) => (
            <li key={j.id}>
              <Link
                href={`/journals/${j.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-foreground">
                    {j.personName ?? "이용자"} 님 활동일지
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {j.serviceDate ?? j.recordDate.slice(0, 10)}
                    {j.scheduledHours != null ? ` · 계획 ${j.scheduledHours}시간` : ""}
                    {j.serviceHours != null
                      ? ` · ${j.scheduledHours != null ? "실적 " : ""}${j.serviceHours}시간`
                      : ""}
                  </p>
                </div>
                {j.isDraft ? (
                  <span className="shrink-0 rounded-(--br-sm) bg-accent-amber/25 px-2 py-1 text-caption font-semibold text-[#B56F10]">
                    임시저장
                  </span>
                ) : (
                  <span className="shrink-0 rounded-(--br-sm) bg-primary-50 px-2 py-1 text-caption font-semibold text-primary-700">
                    제출 완료
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-headline-3 font-bold text-accent-stone">🔁 최근 인수인계</h2>
        <Link href="/handovers" className="text-caption font-semibold text-primary-700 underline">
          전체 보기 →
        </Link>
      </div>
      {handovers.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          받은 인수인계가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {handovers.map((h) => (
            <li key={h.id}>
              <Link
                href="/handovers"
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-caption font-bold text-primary-700"
                >
                  {(h.fromUserName ?? "?").slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-foreground">
                    {h.fromUserName ?? "알 수 없음"} → {h.personName ?? "당사자"} 님 관련
                  </p>
                  <p className="truncate text-caption text-muted-foreground">
                    {h.content} · {formatRelativeTime(h.createdAt)}
                  </p>
                </div>
                {h.priority === "high" ? (
                  <span className="shrink-0 rounded-(--br-sm) bg-domain-med-bg px-2 py-1 text-caption font-bold text-domain-med-text">
                    중요
                  </span>
                ) : !h.acknowledgedAt ? (
                  <span aria-label="읽지 않음" className="size-2 shrink-0 rounded-full bg-domain-med-accent" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl bg-white p-4 text-center ring-1 ring-foreground/10">
      <div className="text-2xl font-extrabold text-primary-700">{n}</div>
      <div className="mt-1 text-caption text-muted-foreground">{label}</div>
    </div>
  );
}
