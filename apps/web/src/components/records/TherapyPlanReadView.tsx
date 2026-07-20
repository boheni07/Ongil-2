import type { TherapyArea, TherapyPlanInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 치료계획서(MED-005)를 `TherapyPlanWizard`(작성 폼)와 동일한
 * fieldset 카드 구성으로 읽기 전용 표시한다(2026-07-20, 사용자 요청 "상세보기도 입력폼과
 * 같은 형식으로"). 필드 그룹·순서·라벨을 위저드와 그대로 맞춰서, 작성할 때 본 화면과
 * 확인할 때 보는 화면이 동일하게 느껴지도록 한다. 다른 record_type도 이 패턴을 따라
 * 점진적으로 추가할 예정 — 지금은 MED-005만 대상.
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

function ReadField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label font-semibold text-accent-stone">{label}</span>
      <span className="whitespace-pre-wrap text-body text-foreground">
        {value || <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

export function TherapyPlanReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<TherapyPlanInput>;
  const goals = c.goals ?? [];

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <legend className="text-sm font-bold text-foreground">대상·기본정보</legend>
        <ReadField
          label="치료 유형"
          value={c.therapy_type ? THERAPY_TYPE_LABEL[c.therapy_type] : undefined}
        />
        <ReadField label="진단명" value={c.diagnosis} />
        <ReadField label="담당 치료사" value={c.responsible_therapist} />
      </fieldset>

      {c.precautions && (
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">초기 평가</legend>
          <ReadField label="초기 평가 소견·주의사항" value={c.precautions} />
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <legend className="text-sm font-bold text-foreground">치료 목표</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadField label="치료 시작일" value={c.plan_period?.start} />
          <ReadField label="치료 종료일" value={c.plan_period?.end} />
        </div>
        {goals.length === 0 && (
          <p className="text-body text-muted-foreground">등록된 목표가 없습니다.</p>
        )}
        {goals.map((g, i) => {
          const meta = AREA_META.find((a) => a.key === g.area);
          return (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4">
              <span className="text-label font-bold text-domain-med-text">
                <span aria-hidden="true">{meta?.icon}</span> {meta?.label ?? g.area}
              </span>
              <ReadField label="장기 목표" value={g.long_term} />
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <ReadField label="단기 목표" value={g.short_term} />
                <ReadField label="목표 점수 (0~100)" value={g.target_score ?? undefined} />
              </div>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <legend className="text-sm font-bold text-foreground">회기 계획</legend>
        <ReadField label="회기 빈도" value={c.session_frequency} />
      </fieldset>
    </div>
  );
}
