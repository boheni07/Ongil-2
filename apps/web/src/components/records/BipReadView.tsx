import type { BehaviorFunction, BipInput, FbaBasis } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 행동중재계획(BIP, EDU-003) 읽기 전용 뷰.
 * BipForm.tsx의 라벨 매핑을 그대로 가져온다.
 */

const BEHAVIOR_FUNCTION_LABEL: Record<BehaviorFunction, string> = {
  attention: "관심획득",
  escape: "회피",
  sensory: "감각추구",
  other: "기타",
};

const FBA_BASIS_LABEL: Record<FbaBasis, string> = {
  observation: "직접 관찰기록",
  guardian_interview: "학부모 면담",
  teacher_interview: "교사 면담",
  checklist: "체크리스트",
};

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

export function BipReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<BipInput>;
  const fbaBasis = c.fba_basis ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-edu-bg/70 p-4 ring-1 ring-domain-edu-accent/25">
        <SummaryStat
          icon="🧩"
          label="행동 기능"
          value={c.behavior_function ? BEHAVIOR_FUNCTION_LABEL[c.behavior_function] : undefined}
        />
        <SummaryStat icon="📅" label="재검토 예정일" value={c.review_date} />
      </div>

      {fbaBasis.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-3 text-sm font-bold text-foreground">기능평가 근거</h3>
          <div className="flex flex-wrap gap-2">
            {fbaBasis.map((b) => (
              <span
                key={b}
                className="rounded-full bg-domain-edu-bg px-3 py-1 text-caption font-semibold text-domain-edu-text"
              >
                {FBA_BASIS_LABEL[b]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">중재 대상 행동</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.target_behavior || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">선행사건 중재 전략</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.antecedent_strategies || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">대체행동</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.replacement_behavior || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">강화 계획</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.reinforcement_plan || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      {c.crisis_procedure && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">위기대응 절차</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.crisis_procedure}</p>
        </div>
      )}
    </div>
  );
}
