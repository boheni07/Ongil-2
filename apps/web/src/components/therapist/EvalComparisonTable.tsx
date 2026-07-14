import type { EvalColumn, EvalComparison } from "@/app/(app)/records/eval/actions";

/**
 * TH-17 3열 비교 뷰(docs/03-uiux.md:330-335). 영역(도메인)별 행 × 초기/중간/최종 3열 + 우측 변화(Δ) 열.
 * 델타는 서버(getEvalComparison)가 이미 계산해 넘겨준 값(finalVsInitial)을 그대로 표시한다(재계산 금지).
 * 아직 제출되지 않은 단계(EvalColumn=null)는 "미제출"로, 해당 열엔 있으나 그 영역 점수가 없으면 "-"로 표시한다.
 * 도메인 한글 라벨은 SessionNoteForm/TherapyPlanWizard와 동일하게 통일한다.
 */

const AREA_LABEL: Record<string, string> = {
  physical: "신체 (구강운동)",
  language: "언어",
  cognitive: "인지",
  social: "사회성",
};

function scoreOf(col: EvalColumn | null, domain: string): number | null {
  const hit = col?.domainScores.find((s) => s.domain === domain);
  return hit ? hit.score : null;
}

/** 열 셀 — 열 자체가 없으면 "미제출", 열은 있으나 해당 영역 점수가 없으면 "-". */
function ScoreCell({ col, domain }: { col: EvalColumn | null; domain: string }) {
  if (!col) return <span className="text-muted-foreground">미제출</span>;
  const score = scoreOf(col, domain);
  return score === null ? (
    <span className="text-muted-foreground">-</span>
  ) : (
    <span className="font-semibold text-foreground">{score}점</span>
  );
}

/** 변화(최종-초기) 셀 — 증가=초록/긍정, 감소=주의(빨강), 변화없음=중립, 값 없음="-". */
function DeltaCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">-</span>;
  if (value > 0)
    return (
      <span className="font-bold text-primary-700">
        +{value} <span aria-hidden="true">↑</span>
        <span className="sr-only">증가</span>
      </span>
    );
  if (value < 0)
    return (
      <span className="font-bold text-red-600">
        {value} <span aria-hidden="true">↓</span>
        <span className="sr-only">감소</span>
      </span>
    );
  return (
    <span className="text-muted-foreground">
      0 <span aria-hidden="true">−</span>
      <span className="sr-only">변화 없음</span>
    </span>
  );
}

export function EvalComparisonTable({ comparison }: { comparison: EvalComparison }) {
  const { columns, deltas } = comparison;

  if (deltas.length === 0) {
    return (
      <p className="rounded-xl bg-muted/40 p-4 text-body text-muted-foreground">
        아직 이 치료계획서에 연결된 평가보고서가 없습니다. 첫 평가를 작성하면 초기·중간·최종 변화가
        여기에 비교 표시됩니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-foreground/10">
      <table className="w-full min-w-[520px] border-collapse text-body">
        <thead>
          <tr className="border-b border-domain-med-accent/30 bg-domain-med-bg/60 text-caption font-bold text-domain-med-text">
            <th scope="col" className="px-4 py-3 text-left">
              영역
            </th>
            <th scope="col" className="px-4 py-3 text-center">
              초기 평가
            </th>
            <th scope="col" className="px-4 py-3 text-center">
              중간 평가
            </th>
            <th scope="col" className="px-4 py-3 text-center">
              최종 평가
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              변화 (최종−초기)
            </th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((d) => (
            <tr key={d.domain} className="border-b border-border last:border-b-0">
              <th
                scope="row"
                className="px-4 py-3 text-left font-semibold text-domain-med-text"
              >
                {AREA_LABEL[d.domain] ?? d.domain}
              </th>
              <td className="px-4 py-3 text-center">
                <ScoreCell col={columns.initial} domain={d.domain} />
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreCell col={columns.interim} domain={d.domain} />
              </td>
              <td className="px-4 py-3 text-center">
                <ScoreCell col={columns.final} domain={d.domain} />
              </td>
              <td className="px-4 py-3 text-right">
                <DeltaCell value={d.finalVsInitial} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
