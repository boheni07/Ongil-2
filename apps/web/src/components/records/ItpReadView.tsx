import type { ItpInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 개별화전환계획(ITP, EDU-005) 읽기 전용 뷰.
 * 요약 바(다음 검토일·흥미영역 수) → 흥미영역 칩 → 현장실습 이력 테이블 → 인계메모 카드.
 */

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="text-xl leading-none">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold tracking-wide text-domain-edu-text/70 uppercase">{label}</span>
        <span className="text-body font-bold text-foreground">
          {value || <span className="font-normal text-muted-foreground">—</span>}
        </span>
      </div>
    </div>
  );
}

export function ItpReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<ItpInput>;
  const areas = c.career_interest_areas ?? [];
  const log = c.work_experience_log ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-edu-bg/70 p-4 ring-1 ring-domain-edu-accent/25">
        <SummaryStat icon="💼" label="진로 흥미영역" value={areas.length ? `${areas.length}개` : undefined} />
        <SummaryStat icon="📅" label="다음 검토일" value={c.next_review_date} />
      </div>

      {areas.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-3 text-sm font-bold text-foreground">진로 흥미영역</h3>
          <div className="flex flex-wrap gap-2">
            {areas.map((a, i) => (
              <span
                key={i}
                className="rounded-full bg-domain-edu-bg px-3 py-1 text-caption font-semibold text-domain-edu-text"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">
          현장실습 이력
        </h3>
        {log.length === 0 ? (
          <p className="p-5 text-body text-muted-foreground">등록된 실습 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">활동</th>
                  <th className="px-3 py-2.5 font-semibold">기간</th>
                  <th className="px-5 py-2.5 font-semibold">비고</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 align-top font-semibold text-domain-edu-text">{e.activity}</td>
                    <td className="px-3 py-3 align-top text-foreground">
                      {e.period.start} ~ {e.period.end}
                    </td>
                    <td className="px-5 py-3 align-top text-foreground">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {c.next_step_note && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">성인기 인계 메모</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.next_step_note}</p>
        </div>
      )}
    </div>
  );
}
