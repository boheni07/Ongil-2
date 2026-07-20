import Link from "next/link";
import type { WeeklyTaskItem } from "@/lib/weekly-tasks";

/**
 * docs/14 워크숍 Wave W-2 — 마감일 기반 "이번 주 처리할 일" 공용 카드.
 * 특수교사·사회복지사 홈에서 재사용한다(치료사·활동지원사는 백로그 기반이라 별도 컴포넌트 W-3).
 */
export function WeeklyTaskCard({ items }: { items: WeeklyTaskItem[] }) {
  return (
    <section className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
      <h3 className="mb-2 text-body font-bold text-accent-stone">📅 이번 주 처리할 일</h3>
      {items.length === 0 ? (
        <p className="text-caption text-muted-foreground">이번 주 마감인 항목이 없습니다.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item, i) => (
            <li key={`${item.personId}-${item.recordType}-${i}`} className="border-b border-border/60 last:border-0">
              <Link
                href={item.href}
                className="flex items-center gap-2.5 py-2.5 text-caption text-foreground hover:text-primary-700"
              >
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${item.dday < 0 ? "bg-red-500" : item.dday <= 2 ? "bg-domain-dai-accent" : "bg-domain-med-accent"}`}
                />
                <span className="min-w-0 flex-1 truncate">
                  {item.personName} · {item.label}
                </span>
                <span
                  className={`shrink-0 font-bold ${item.dday < 0 ? "text-red-600" : "text-accent-stone"}`}
                >
                  {item.dday < 0 ? `기한 ${Math.abs(item.dday)}일 초과` : `D-${item.dday}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
