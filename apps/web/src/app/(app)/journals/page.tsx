import Link from "next/link";
import { getSupporterJournals } from "@/app/(app)/journal/actions";

/**
 * S-13 일지 목록 — 프로토타입 web-supporter.html 사이드바 "📄 일지 목록"에 대응(2026-07-19
 * 이전엔 웹에 이 목록 화면 자체가 없었다, 모바일엔 JournalListScreen으로 이미 존재).
 */
export default async function JournalListPage() {
  const journals = await getSupporterJournals(50);

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-headline-1 font-extrabold text-foreground">일지 목록</h1>
      <p className="mt-1 text-body text-muted-foreground">최근 작성한 활동지원 일지 {journals.length}건</p>

      {journals.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          작성한 일지가 없습니다.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {journals.map((j) => (
            <li key={j.id}>
              <Link
                href={`/journals/${j.id}`}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
              >
                <span className="flex flex-col">
                  <span className="text-body font-semibold text-foreground">
                    {j.personName ?? "당사자"} · {j.serviceDate ?? j.recordDate.slice(0, 10)}
                    {j.isDraft && (
                      <span className="ml-2 rounded-[4px] bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                        임시저장
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 text-caption text-muted-foreground">
                    실적 {j.serviceHours ?? "-"}시간
                    {j.scheduledHours !== null && ` · 계획 ${j.scheduledHours}시간`}
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
