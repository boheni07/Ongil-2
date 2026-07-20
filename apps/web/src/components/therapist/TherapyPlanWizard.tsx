"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TherapyArea, TherapyPlanInput } from "@ongil/validation";
import { createTherapyPlan, type TherapistClient } from "@/app/(app)/records/therapy/actions";
import { DateField } from "@/components/form/DateField";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { computeAge, isSelfConfirmingStage } from "@/lib/lifecycle";
import { Button } from "@/components/ui/button";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";

/**
 * TH-13 치료계획서 작성 — 대상·기본정보·초기평가·치료목표·회기계획을 한 화면에서 입력한다
 * (2026-07-19, 기존 5단계 위저드를 병합해 대체). goals[].area는 4개 치료영역 enum이라
 * 4개 영역을 고정 행으로 두고 입력된(장기/단기 중 하나라도 채운) 영역만 전송한다(최소 1개 필수).
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

const THERAPY_TYPES: { value: TherapyPlanInput["therapy_type"]; label: string }[] = [
  { value: "speech", label: "언어치료" },
  { value: "physical", label: "물리치료" },
  { value: "occupational", label: "작업치료" },
  { value: "psychological", label: "심리치료" },
  { value: "other", label: "기타" },
];

const AREA_META: { key: TherapyArea; icon: string; label: string }[] = [
  { key: "physical", icon: "🖐", label: "신체 (구강운동)" },
  { key: "language", icon: "💬", label: "언어" },
  { key: "cognitive", icon: "🧠", label: "인지" },
  { key: "social", icon: "🤝", label: "사회성" },
];

interface GoalDraft {
  long_term: string;
  short_term: string;
  target_score: string;
}

function emptyGoals(): Record<TherapyArea, GoalDraft> {
  return {
    physical: { long_term: "", short_term: "", target_score: "" },
    language: { long_term: "", short_term: "", target_score: "" },
    cognitive: { long_term: "", short_term: "", target_score: "" },
    social: { long_term: "", short_term: "", target_score: "" },
  };
}

export function TherapyPlanWizard({
  clients,
  initialPersonId,
}: {
  clients: TherapistClient[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [personId, setPersonId] = usePersonSelection(clients, initialPersonId);

  const [therapyType, setTherapyType] =
    useState<TherapyPlanInput["therapy_type"]>("speech");
  const [diagnosis, setDiagnosis] = useState("");
  const [responsibleTherapist, setResponsibleTherapist] = useState("");
  const [precautions, setPrecautions] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [goals, setGoals] = useState<Record<TherapyArea, GoalDraft>>(emptyGoals());
  const [sessionFrequency, setSessionFrequency] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );

  function updateGoal(area: TherapyArea, patch: Partial<GoalDraft>) {
    setGoals((prev) => ({ ...prev, [area]: { ...prev[area], ...patch } }));
  }

  const filledGoals = useMemo(
    () =>
      AREA_META.filter(
        ({ key }) => goals[key].long_term.trim() || goals[key].short_term.trim()
      ),
    [goals]
  );

  function buildInput(): TherapyPlanInput & { personId: string } {
    const goalArray = filledGoals.map(({ key }) => {
      const g = goals[key];
      const score = g.target_score.trim() === "" ? undefined : Number(g.target_score);
      return {
        area: key,
        long_term: g.long_term.trim(),
        short_term: g.short_term.trim(),
        ...(score != null && Number.isFinite(score)
          ? { target_score: Math.round(score) }
          : {}),
      };
    });

    return {
      personId,
      plan_period: { start: periodStart, end: periodEnd },
      diagnosis: diagnosis.trim(),
      therapy_type: therapyType,
      goals: goalArray,
      session_frequency: sessionFrequency.trim(),
      responsible_therapist: responsibleTherapist.trim(),
      ...(precautions.trim() ? { precautions: precautions.trim() } : {}),
    };
  }

  const canSubmit = Boolean(
    personId &&
      diagnosis.trim() &&
      responsibleTherapist.trim() &&
      periodStart &&
      periodEnd &&
      filledGoals.length > 0 &&
      sessionFrequency.trim()
  );

  async function submit() {
    if (!canSubmit) {
      setError("아동·진단명·담당치료사·치료기간·목표 1개 이상·회기 빈도를 모두 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createTherapyPlan(buildInput());
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(res.recordId ? `/records/therapy-plan/${res.recordId}` : "/home");
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">치료계획서 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 아동이 없어 치료계획서를 작성할 수 없습니다. 보호자가 의료(MED) 도메인 작성 권한을
          부여하면 해당 아동의 치료계획서를 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">치료계획서 작성</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {client
          ? `${client.fullName} (만 ${computeAge(client.birthDate)}세) · ${
              THERAPY_TYPES.find((t) => t.value === therapyType)?.label ?? ""
            }`
          : "아동을 선택하세요"}
        {client && (
          <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />
        )}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">대상·기본정보</legend>
          <Field label="대상 아동" required>
            <select
              className={fieldClass}
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.personId} value={c.personId}>
                  {c.fullName} (만 {computeAge(c.birthDate)}세)
                </option>
              ))}
            </select>
          </Field>
          <Field label="치료 유형" required>
            <select
              className={fieldClass}
              value={therapyType}
              onChange={(e) =>
                setTherapyType(e.target.value as TherapyPlanInput["therapy_type"])
              }
            >
              {THERAPY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="진단명" required>
            <input
              className={fieldClass}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="예: 표현·수용 언어 발달지연"
            />
          </Field>
          <Field label="담당 치료사" required>
            <input
              className={fieldClass}
              value={responsibleTherapist}
              onChange={(e) => setResponsibleTherapist(e.target.value)}
              placeholder="예: 박서연 언어치료사"
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">초기 평가 (선택)</legend>
          <Field label="초기 평가 소견·주의사항">
            <textarea
              className={`${fieldClass} min-h-40`}
              value={precautions}
              onChange={(e) => setPrecautions(e.target.value)}
              maxLength={2000}
              placeholder="표준화 검사 결과, 강점·약점, 발작·알레르기 등 치료 시 유의할 사항을 기록하세요"
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">치료 목표</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="치료 시작일" required>
              <DateField className={fieldClass} value={periodStart} onChange={setPeriodStart} max={periodEnd || undefined} />
            </Field>
            <Field label="치료 종료일" required>
              <DateField className={fieldClass} value={periodEnd} onChange={setPeriodEnd} min={periodStart || undefined} />
            </Field>
          </div>
          <p className="text-body text-muted-foreground">
            4개 영역별 장기·단기 목표를 설정합니다. 하나 이상의 영역에 목표를 입력해야 합니다.
          </p>
          {AREA_META.map(({ key, icon, label }) => (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4"
            >
              <span className="text-label font-bold text-domain-med-text">
                <span aria-hidden="true">{icon}</span> {label}
                {key === "language" ? "  · 핵심" : ""}
              </span>
              <Field label="장기 목표">
                <textarea
                  className={`${fieldClass} min-h-16`}
                  value={goals[key].long_term}
                  onChange={(e) => updateGoal(key, { long_term: e.target.value })}
                  placeholder="구강 근육 협응력 향상 — 조음 정확도 60%→80% 달성"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <Field label="단기 목표">
                  <input
                    className={fieldClass}
                    value={goals[key].short_term}
                    onChange={(e) => updateGoal(key, { short_term: e.target.value })}
                    placeholder="2어절 표현 자발 산출 회기당 10회"
                  />
                </Field>
                <Field label="목표 점수 (0~100)">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={fieldClass}
                    value={goals[key].target_score}
                    onChange={(e) => updateGoal(key, { target_score: e.target.value })}
                    placeholder="80"
                  />
                </Field>
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">회기 계획</legend>
          <Field label="회기 빈도" required>
            <input
              className={fieldClass}
              value={sessionFrequency}
              onChange={(e) => setSessionFrequency(e.target.value)}
              placeholder="예: 주 2회 · 회기당 40분 (총 24회기)"
            />
          </Field>
        </fieldset>

      </div>

      {/* 오른쪽 사이드바(lg:sticky) — 확인 요청 대상 안내·액션 버튼을 스크롤 중에도 계속
          접근 가능하게 둔다(2026-07-20, JournalWizard와 동일한 원칙). */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="rounded-xl bg-domain-med-bg p-4 text-body text-domain-med-text ring-1 ring-domain-med-accent/30">
          ✅ 치료계획서는 공식 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다. 저장 후 아동
          타임라인과 계획서 상세에 기록됩니다.
          <span className="mt-2 block font-bold">
            📋 확인 요청 대상: {client && isSelfConfirmingStage(client.lifeStage) ? "본인" : "보호자"}
          </span>
        </div>

        {error && (
          <p role="alert" className="text-body font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
          <TargetPersonBanner name={client?.fullName} />
          <Button
            type="button"
            className="h-11 bg-primary-600 font-bold"
            disabled={busy || !canSubmit}
            onClick={submit}
          >
            {busy ? "저장 중..." : "치료계획서 저장"}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => router.push("/home")}>
            취소
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label font-semibold text-accent-stone">
        {label} {required && <span className="text-domain-med-text">*</span>}
      </span>
      {children}
    </label>
  );
}
