import type { SessionNoteInput, TherapyArea } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 회기 일지(MED-006) 읽기 전용 뷰.
 * SessionNoteForm.tsx와 동일한 영역 라벨(신체/언어/인지/사회성)을 사용한다.
 */

const AREA_META: { key: TherapyArea; icon: string; label: string }[] = [
  { key: "physical", icon: "🖐", label: "신체 (구강운동)" },
  { key: "language", icon: "💬", label: "언어" },
  { key: "cognitive", icon: "🧠", label: "인지" },
  { key: "social", icon: "🤝", label: "사회성" },
];

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="text-xl leading-none">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold tracking-wide text-domain-med-text/70 uppercase">{label}</span>
        <span className="text-body font-bold text-foreground">
          {value || <span className="font-normal text-muted-foreground">—</span>}
        </span>
      </div>
    </div>
  );
}

export function SessionNoteReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<SessionNoteInput>;
  const goals = c.planned_goals ?? [];
  const scores = c.domain_scores;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-med-bg/70 p-4 ring-1 ring-domain-med-accent/25">
        <SummaryStat icon="📅" label="회기 일자" value={c.session_date} />
        <SummaryStat icon="🔢" label="회기 차수" value={c.session_number != null ? `${c.session_number}회기차` : undefined} />
      </div>

      {goals.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">계획된 목표</h3>
          <ul className="flex flex-col gap-1 text-body text-foreground">
            {goals.map((g, i) => (
              <li key={i}>· {g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">주요 활동 내용</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.actual_progress || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">아동 반응·특이사항</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.observations || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      {scores && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">
            영역별 달성도
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">영역</th>
                  <th className="px-5 py-2.5 text-right font-semibold">점수</th>
                </tr>
              </thead>
              <tbody>
                {AREA_META.map(({ key, icon, label }) => (
                  <tr key={key} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-semibold text-domain-med-text">
                      <span aria-hidden="true">{icon}</span> {label}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className="inline-flex rounded-full bg-domain-med-bg px-2.5 py-1 text-caption font-bold text-domain-med-text">
                        {scores[key]}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {c.next_session_plan && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">다음 회기 계획</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.next_session_plan}</p>
        </div>
      )}
    </div>
  );
}
