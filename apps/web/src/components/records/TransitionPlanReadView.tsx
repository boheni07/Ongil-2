import type { TrainingRecord, TransitionPlanInput } from "@ongil/validation";
import { RoadmapProgress } from "@/components/social-worker/RoadmapProgress";

/**
 * G-20 기록 관리 우측 상세 — 전환계획(TRA-001) 읽기 전용 뷰.
 * 로드맵 단계는 기존 RoadmapProgress를 읽기 전용(onChange 없음)으로 재사용한다.
 */

const TRAINING_STATUS_LABEL: Record<TrainingRecord["status"], string> = {
  planned: "예정",
  ongoing: "진행중",
  completed: "완료",
};

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="text-xl leading-none">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold tracking-wide text-domain-tra-text/70 uppercase">{label}</span>
        <span className="text-body font-bold text-foreground">
          {value || <span className="font-normal text-muted-foreground">—</span>}
        </span>
      </div>
    </div>
  );
}

export function TransitionPlanReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<TransitionPlanInput>;
  const trainings = c.training_records ?? [];
  const agencies = c.linked_agencies ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-tra-bg/70 p-4 ring-1 ring-domain-tra-accent/25">
        <SummaryStat icon="🎯" label="희망 진로" value={c.career_goal} />
        <SummaryStat icon="🧑‍💼" label="담당자" value={c.case_manager} />
        <SummaryStat icon="📅" label="다음 검토일" value={c.next_review_date} />
      </div>

      {c.roadmap_stage && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-3 text-sm font-bold text-foreground">로드맵 단계</h3>
          <RoadmapProgress stage={c.roadmap_stage} />
        </div>
      )}

      {c.independent_living_plan && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">자립생활 계획</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
            {c.independent_living_plan}
          </p>
        </div>
      )}

      {trainings.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">훈련 이력</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">프로그램</th>
                  <th className="px-3 py-2.5 font-semibold">제공기관</th>
                  <th className="px-3 py-2.5 font-semibold">기간</th>
                  <th className="px-5 py-2.5 text-right font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {trainings.map((t, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 align-top font-semibold text-domain-tra-text">{t.program || "—"}</td>
                    <td className="px-3 py-3 align-top text-foreground">{t.provider || "—"}</td>
                    <td className="px-3 py-3 align-top text-foreground">
                      {t.period.start} ~ {t.period.end}
                    </td>
                    <td className="px-5 py-3 text-right align-top">
                      <span className="inline-flex rounded-full bg-domain-tra-bg px-2.5 py-1 text-caption font-bold text-domain-tra-text">
                        {TRAINING_STATUS_LABEL[t.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {agencies.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">연계 기관</h3>
          <ul className="flex flex-col gap-1 text-body text-foreground">
            {agencies.map((a, i) => (
              <li key={i}>· {a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
