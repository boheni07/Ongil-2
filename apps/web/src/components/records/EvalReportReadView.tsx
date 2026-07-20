import type { EvalReportInput, TherapyArea } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 평가보고서(MED-007) 읽기 전용 뷰.
 * EvalReportForm.tsx와 동일한 평가 단계·영역 라벨을 사용한다.
 */

const EVAL_TYPE_LABEL: Record<EvalReportInput["eval_type"], string> = {
  initial: "초기 평가",
  interim: "중간 평가",
  final: "최종 평가",
};

const AREA_LABEL: Record<TherapyArea, string> = {
  physical: "신체 (구강운동)",
  language: "언어",
  cognitive: "인지",
  social: "사회성",
};

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

export function EvalReportReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<EvalReportInput>;
  const scores = c.domain_scores ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-med-bg/70 p-4 ring-1 ring-domain-med-accent/25">
        <SummaryStat icon="📋" label="평가 단계" value={c.eval_type ? EVAL_TYPE_LABEL[c.eval_type] : undefined} />
        <SummaryStat icon="📅" label="평가 일자" value={c.eval_date} />
      </div>

      {scores.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">
            영역별 평가 점수
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
                {scores.map((s, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-semibold text-domain-med-text">{AREA_LABEL[s.domain]}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className="inline-flex rounded-full bg-domain-med-bg px-2.5 py-1 text-caption font-bold text-domain-med-text">
                        {s.score}점
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">종합 평가 요약</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.summary || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      {c.recommendations && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">향후 권고사항</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.recommendations}</p>
        </div>
      )}
    </div>
  );
}
