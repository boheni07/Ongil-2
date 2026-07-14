import Link from "next/link";

/**
 * docs/02-ia.md §3-10 G-01 "확인 대기 기록 N건" 요약 카드.
 * 공식 문서(IEP·ISP·치료계획서 등) 중 아직 확인하지 않은 기록 건수를 요약하고,
 * G-20 기록 관리(/persons/{id}/records)로 이동하는 진입점을 제공한다.
 * "승인/반려"가 아닌 "확인" 개념만 표현한다.
 */
export function PendingConfirmCard({ count, personId }: { count: number; personId: string }) {
  if (count <= 0) {
    return (
      <p className="mt-2 text-caption text-muted-foreground">확인 대기 중인 기록이 없습니다.</p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-(--br-md) bg-domain-dai-bg p-4 ring-1 ring-domain-dai-accent/30">
      <p className="text-body text-foreground">
        확인 대기 기록 <b className="font-extrabold text-domain-dai-text">{count}건</b>이 있습니다.
        내용을 확인해 주세요.
      </p>
      <Link
        href={`/persons/${personId}/records`}
        className="inline-block shrink-0 rounded-(--br-md) bg-primary-600 px-4 py-2 text-caption font-bold text-white"
      >
        확인하러 가기 →
      </Link>
    </div>
  );
}
