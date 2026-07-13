"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TherapyArea, TherapyPlanInput } from "@ongil/validation";
import { createTherapyPlan, type TherapistClient } from "@/app/(app)/records/therapy/actions";
import { WizardProgress } from "@/components/form/WizardProgress";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { computeAge } from "@/lib/lifecycle";
import { Button } from "@/components/ui/button";

/**
 * TH-13 치료계획서 작성 5단계 위저드(프로토타입 web-therapist.html 226~265줄).
 * 대상·기본정보 → 초기평가 → 치료목표 → 회기계획 → 검토·확정.
 * 프로토타입은 3단계(치료목표: 치료기간 + 4개 영역별 목표)만 상세히 나와 있어, 나머지 단계는
 * therapyPlanSchema(MED-005)에 맞춰 구성했다. goals[].area는 4개 치료영역 enum이라
 * 4개 영역을 고정 행으로 두고 입력된(장기/단기 중 하나라도 채운) 영역만 전송한다(최소 1개 필수).
 */

const STEP_LABELS = ["대상·기본정보", "초기 평가", "치료 목표", "회기 계획", "검토·확정"];

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
  const [step, setStep] = useState(1);
  const [personId, setPersonId] = useState(
    initialPersonId && clients.some((c) => c.personId === initialPersonId)
      ? initialPersonId
      : clients[0]?.personId ?? ""
  );

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

  async function submit() {
    if (!personId) {
      setError("아동을 선택해주세요.");
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

  function nextStep() {
    setError(null);
    setStep((s) => Math.min(5, s + 1));
  }
  function prevStep() {
    setError(null);
    if (step === 1) {
      router.push("/home");
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  }

  const canNext =
    (step === 1 && !!personId && !!diagnosis.trim() && !!responsibleTherapist.trim()) ||
    step === 2 ||
    (step === 3 && !!periodStart && !!periodEnd && filledGoals.length > 0) ||
    (step === 4 && !!sessionFrequency.trim());

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
    <div className="flex flex-1 flex-col">
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

      <WizardProgress current={step} total={5} label={STEP_LABELS[step - 1]} className="mt-5 mb-6" />

      {step === 1 && (
        <div className="flex flex-col gap-4">
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
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">
            초기 평가 소견과 치료 시 주의사항을 기록합니다. (선택)
          </p>
          <Field label="초기 평가 소견·주의사항">
            <textarea
              className={`${fieldClass} min-h-40`}
              value={precautions}
              onChange={(e) => setPrecautions(e.target.value)}
              maxLength={2000}
              placeholder="표준화 검사 결과, 강점·약점, 발작·알레르기 등 치료 시 유의할 사항을 기록하세요"
            />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="치료 시작일" required>
              <input
                type="date"
                className={fieldClass}
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </Field>
            <Field label="치료 종료일" required>
              <input
                type="date"
                className={fieldClass}
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
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
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">회기 운영 계획을 입력합니다.</p>
          <Field label="회기 빈도" required>
            <input
              className={fieldClass}
              value={sessionFrequency}
              onChange={(e) => setSessionFrequency(e.target.value)}
              placeholder="예: 주 2회 · 회기당 40분 (총 24회기)"
            />
          </Field>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-domain-med-bg p-4 ring-1 ring-domain-med-accent/40">
            <SummaryRow
              k="대상 아동"
              v={client ? `${client.fullName} (만 ${computeAge(client.birthDate)}세)` : "-"}
            />
            <SummaryRow
              k="치료 유형 / 진단"
              v={`${THERAPY_TYPES.find((t) => t.value === therapyType)?.label ?? "-"} / ${
                diagnosis || "-"
              }`}
            />
            <SummaryRow k="담당 치료사" v={responsibleTherapist || "-"} />
            <SummaryRow
              k="치료 기간"
              v={periodStart && periodEnd ? `${periodStart} ~ ${periodEnd}` : "-"}
            />
            <SummaryRow k="회기 빈도" v={sessionFrequency || "-"} />
            <SummaryRow k="치료 목표" v={`${filledGoals.length}개 영역`} last />
          </div>
          <div className="rounded-(--br-md) bg-primary-50 p-4 text-body text-primary-700">
            ✅ 치료계획서는 공식 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다. 확인 요청 대상은
            {client?.lifeStage === "adult" ? " 본인" : " 주보호자"}입니다. 저장 후 아동 타임라인과 계획서
            상세에 기록됩니다.
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-8">
        <Button type="button" variant="outline" className="h-11" onClick={prevStep}>
          ← {step === 1 ? "취소" : "이전"}
        </Button>
        <div className="flex-1" />
        {step < 5 ? (
          <Button type="button" className="h-11" disabled={!canNext} onClick={nextStep}>
            다음 →
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 bg-primary-600 font-bold"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "저장 중..." : "치료계획서 저장"}
          </Button>
        )}
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

function SummaryRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 py-2 text-body ${
        last ? "" : "border-b border-domain-med-accent/25"
      }`}
    >
      <span className="shrink-0 font-semibold text-domain-med-text">{k}</span>
      <span className="text-right text-foreground">{v}</span>
    </div>
  );
}
