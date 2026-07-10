import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupporterJournals } from "@/app/(app)/journal/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { Button } from "@/components/ui/button";

/**
 * S-13 활동일지 상세(읽기 전용). 상세 전용 조회 API가 없어 목록(getSupporterJournals)에서
 * id로 찾아 요약 수준 정보만 표시한다.
 */
export default async function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const journals = await getSupporterJournals(100);
  const journal = journals.find((j) => j.id === id);
  if (!journal) notFound();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3">
        <h1 className="text-headline-2 font-extrabold text-foreground">활동일지</h1>
        <DomainChip domain="DAI" />
        {journal.isDraft ? (
          <span className="rounded-(--br-sm) bg-accent-amber/25 px-2 py-1 text-caption font-semibold text-[#B56F10]">임시저장</span>
        ) : (
          <span className="rounded-(--br-sm) bg-primary-50 px-2 py-1 text-caption font-semibold text-primary-700">제출 완료</span>
        )}
      </div>
      <p className="mt-1 text-body text-muted-foreground">
        {journal.personName ?? "이용자"} 님 · {journal.serviceDate ?? journal.recordDate.slice(0, 10)}
      </p>

      <div className="mt-6 rounded-xl bg-white p-5 ring-1 ring-foreground/10">
        <h2 className="text-headline-3 font-bold text-accent-stone">서비스 정보</h2>
        <dl className="mt-3 grid grid-cols-[100px_1fr] gap-y-2 text-body">
          <dt className="text-muted-foreground">이용자</dt>
          <dd className="text-foreground">{journal.personName ?? "이용자"}</dd>
          <dt className="text-muted-foreground">서비스 일자</dt>
          <dd className="text-foreground">{journal.serviceDate ?? "-"}</dd>
          <dt className="text-muted-foreground">서비스 시간</dt>
          <dd className="text-foreground">{journal.serviceHours != null ? `${journal.serviceHours}시간` : "-"}</dd>
        </dl>
      </div>

      <div className="mt-6">
        <Button variant="outline" render={<Link href="/home" />} className="h-11">
          ← 목록으로
        </Button>
      </div>
    </div>
  );
}
