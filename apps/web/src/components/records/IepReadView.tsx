import type { IepInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — IEP(EDU-001) 읽기 전용 뷰.
 * TherapyPlanReadView와 동일 패턴: 상단 요약 바 → 기본정보 표 → 현재 수준 표 →
 * 연간 목표(+단기 목표) 테이블 → 지원 서비스 테이블 → 전환계획(선택) 카드.
 */

const TRANSITION_AREA_LABEL: Record<
  NonNullable<NonNullable<IepInput["transition_plan"]>["goal_area"]>,
  string
> = {
  career: "진로·직업",
  independent_living: "자립생활",
  community: "지역사회 참여",
  further_education: "계속교육",
};

const LEVEL_FIELDS: { key: keyof IepInput["current_levels"]; label: string }[] = [
  { key: "korean", label: "국어" },
  { key: "math", label: "수학" },
  { key: "social", label: "사회성" },
  { key: "communication", label: "의사소통" },
  { key: "self_care", label: "자조기술" },
];

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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-5 py-3">
      <dt className="text-label font-semibold text-accent-stone">{label}</dt>
      <dd className="whitespace-pre-wrap text-body text-foreground">
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export function IepReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<IepInput>;
  const goals = c.annual_goals ?? [];
  const services = c.support_services ?? [];
  const tp = c.transition_plan;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-edu-bg/70 p-4 ring-1 ring-domain-edu-accent/25">
        <SummaryStat icon="🏫" label="학교" value={c.school} />
        <SummaryStat icon="📅" label="학년도" value={c.academic_year} />
        <SummaryStat icon="🗓" label="회의 날짜" value={c.meeting_date} />
        <SummaryStat icon="🎯" label="연간 목표" value={goals.length ? `${goals.length}개` : undefined} />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">기본정보</h3>
        <dl className="divide-y divide-border">
          <InfoRow label="참석자" value={(c.participants ?? []).join(", ")} />
        </dl>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">현재 수준</h3>
        <dl className="divide-y divide-border">
          {LEVEL_FIELDS.map((f) => (
            <InfoRow key={f.key} label={f.label} value={c.current_levels?.[f.key]} />
          ))}
        </dl>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">연간 목표</h3>
        {goals.length === 0 ? (
          <p className="p-5 text-body text-muted-foreground">등록된 목표가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">영역</th>
                  <th className="px-3 py-2.5 font-semibold">연간 목표</th>
                  <th className="px-3 py-2.5 font-semibold">단기 목표</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 align-top">
                      <span className="whitespace-nowrap font-bold text-domain-edu-text">{g.area || "—"}</span>
                    </td>
                    <td className="px-3 py-3 align-top text-foreground">{g.goal || "—"}</td>
                    <td className="px-3 py-3 align-top text-foreground">
                      {g.short_term_goals.length === 0 ? (
                        "—"
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {g.short_term_goals.map((st, si) => (
                            <li key={si}>
                              {st.goal}
                              {st.period && <span className="text-caption text-muted-foreground"> · {st.period}</span>}
                              {st.evaluation && <span className="text-caption text-muted-foreground"> · {st.evaluation}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {services.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">지원 서비스</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">서비스</th>
                  <th className="px-3 py-2.5 font-semibold">제공자</th>
                  <th className="px-5 py-2.5 font-semibold">빈도</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 text-foreground">{s.service || "—"}</td>
                    <td className="px-3 py-3 text-foreground">{s.provider || "—"}</td>
                    <td className="px-5 py-3 text-foreground">{s.frequency || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tp && (
        <div className="rounded-xl bg-domain-tra-bg/60 p-5 shadow-sm ring-1 ring-domain-tra-accent/25">
          <h3 className="mb-3 text-sm font-bold text-domain-tra-text">🔀 전환계획</h3>
          <dl className="flex flex-col gap-2">
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-label font-semibold text-accent-stone">목표 영역</dt>
              <dd className="text-body text-foreground">{tp.goal_area ? TRANSITION_AREA_LABEL[tp.goal_area] : "—"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-label font-semibold text-accent-stone">희망 진로</dt>
              <dd className="text-body text-foreground">{tp.goal || "—"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-label font-semibold text-accent-stone">전환 활동</dt>
              <dd className="whitespace-pre-wrap text-body text-foreground">
                {tp.steps.length ? tp.steps.map((s, i) => <div key={i}>· {s}</div>) : "—"}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-label font-semibold text-accent-stone">연계 기관</dt>
              <dd className="text-body text-foreground">{tp.linked_agencies || "—"}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
