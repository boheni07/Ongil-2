import type { TherapyArea, TherapyPlanInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 치료계획서(MED-005) 읽기 전용 뷰(2026-07-20).
 * 1차 버전은 작성 폼(TherapyPlanWizard)과 똑같이 세로 fieldset 카드를 나열했는데, "세로로만
 * 배열하지 말고 표 형식도 섞어서 더 세련되고 가독성 좋게"라는 후속 피드백으로 재설계했다.
 * - 상단 요약 바: 치료 유형·치료 기간·회기 빈도를 한눈에 훑을 수 있게 가로 배치.
 * - 기본정보: 세로 나열 대신 라벨|값 가로 표(정의목록) 형태로 압축.
 * - 영역별 목표: 4개를 각각 카드로 쌓던 것을 진짜 `<table>`로 바꿔 영역·장기·단기·점수를
 *   한 행씩 가로로 비교할 수 있게 했다(점수는 tabular-nums로 자릿수 정렬).
 */

const THERAPY_TYPE_LABEL: Record<TherapyPlanInput["therapy_type"], string> = {
  speech: "언어치료",
  physical: "물리치료",
  occupational: "작업치료",
  psychological: "심리치료",
  other: "기타",
};

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

export function TherapyPlanReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<TherapyPlanInput>;
  const goals = c.goals ?? [];
  const period =
    c.plan_period?.start && c.plan_period?.end ? `${c.plan_period.start} ~ ${c.plan_period.end}` : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-med-bg/70 p-4 ring-1 ring-domain-med-accent/25">
        <SummaryStat icon="🩺" label="치료 유형" value={c.therapy_type ? THERAPY_TYPE_LABEL[c.therapy_type] : undefined} />
        <SummaryStat icon="📅" label="치료 기간" value={period} />
        <SummaryStat icon="🔁" label="회기 빈도" value={c.session_frequency} />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">기본정보</h3>
        <dl className="divide-y divide-border">
          <InfoRow label="진단명" value={c.diagnosis} />
          <InfoRow label="담당 치료사" value={c.responsible_therapist} />
        </dl>
      </div>

      {c.precautions && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">초기 평가 소견·주의사항</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.precautions}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">
          영역별 치료 목표
        </h3>
        {goals.length === 0 ? (
          <p className="p-5 text-body text-muted-foreground">등록된 목표가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">영역</th>
                  <th className="px-3 py-2.5 font-semibold">장기 목표</th>
                  <th className="px-3 py-2.5 font-semibold">단기 목표</th>
                  <th className="px-5 py-2.5 text-right font-semibold">목표 점수</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g, i) => {
                  const meta = AREA_META.find((a) => a.key === g.area);
                  return (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3 align-top">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-domain-med-text">
                          <span aria-hidden="true">{meta?.icon}</span>
                          {meta?.label ?? g.area}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-foreground">{g.long_term || "—"}</td>
                      <td className="px-3 py-3 align-top text-foreground">{g.short_term || "—"}</td>
                      <td className="px-5 py-3 text-right align-top tabular-nums">
                        {g.target_score != null ? (
                          <span className="inline-flex rounded-full bg-domain-med-bg px-2.5 py-1 text-caption font-bold text-domain-med-text">
                            {g.target_score}점
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
