import Link from "next/link";

export interface BacklogTaskItem {
  personId: string;
  personName: string;
  label: string;
  href: string;
}

/**
 * docs/14 워크숍 Wave W-3 — 백로그 기반 "처리 대기 중" 공용 카드.
 * 치료사(계획서 미작성 대상자)·활동지원사(임시저장 일지)처럼 마감일 데이터가 없는 역할이
 * 쓴다. 날짜/D-day 개념이 없어 WeeklyTaskCard와 별도 컴포넌트로 뒀다(§2 토론 결론 —
 * "이번 주"라고 억지로 우기지 않는다). 완료된 항목은 원천 쿼리에서 이미 빠지므로 이 카드는
 * 항상 "아직 안 끝난 것"만 받는다 — 완료 표시를 별도로 하지 않는다.
 */
export function BacklogTaskCard({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: BacklogTaskItem[];
}) {
  return (
    <section className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
      <h3 className="mb-2 text-body font-bold text-accent-stone">{title}</h3>
      {items.length === 0 ? (
        <p className="text-caption text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item, i) => (
            <li key={`${item.personId}-${i}`} className="border-b border-border/60 last:border-0">
              <Link
                href={item.href}
                className="flex items-center gap-2.5 py-2.5 text-caption text-foreground hover:text-primary-700"
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-domain-dai-accent" />
                <span className="min-w-0 flex-1 truncate">
                  {item.personName} · {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
