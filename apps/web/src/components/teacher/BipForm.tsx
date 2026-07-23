"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BehaviorFunction, BipInput, FbaBasis } from "@ongil/validation";
import { createBip, type BipClient } from "@/app/(app)/records/bip/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/form/DateField";
import { ChoiceGroup, ChoiceCheckGroup } from "@/components/form/ChoiceGroup";
import { isSelfConfirmingStage } from "@/lib/lifecycle";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";

/**
 * T-17 행동중재계획(BIP, EDU-003) 작성 — 단일 폼(ObservationForm 스타일).
 * 학생 선택 → 중재 대상 행동·행동 기능 → 선행사건 전략·대체행동·강화 계획 → 위기대응(선택)·재검토일.
 * BIP는 IEP·ISP·치료계획서와 동급 공식 지원계획 문서라 requires_confirmation=true(§4-6①) —
 * 저장 시 trg_assign_confirmer가 확인 주체(성년=본인, 미성년=주보호자)를 자동 지정한다.
 * 확인 요청 대상은 isSelfConfirmingStage로 안내한다(LEG-001 GuardianshipReportWizard와 동일 패턴).
 * confirmer_id/confirmed_at은 서버 트리거 소관이라 폼에서 다루지 않는다.
 */

const BEHAVIOR_FUNCTIONS: { value: BehaviorFunction; label: string; hint: string }[] = [
  { value: "attention", label: "관심획득", hint: "타인의 관심·반응을 얻기 위한 행동" },
  { value: "escape", label: "회피", hint: "과제·상황을 피하거나 벗어나기 위한 행동" },
  { value: "sensory", label: "감각추구", hint: "감각 자극 자체를 얻기 위한 행동" },
  { value: "other", label: "기타", hint: "위 분류에 속하지 않는 경우" },
];

/** 기능평가 근거(FbaBasis) 선택지 — 2026-07-17 워크숍 안건2-1, EDU-003에 병합. */
const FBA_BASIS_OPTIONS: { value: FbaBasis; label: string }[] = [
  { value: "observation", label: "직접 관찰기록" },
  { value: "guardian_interview", label: "학부모 면담" },
  { value: "teacher_interview", label: "교사 면담" },
  { value: "checklist", label: "체크리스트" },
];

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

export function BipForm({
  students,
  initialPersonId,
}: {
  students: BipClient[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [personId, setPersonId] = usePersonSelection(students, initialPersonId);

  const [targetBehavior, setTargetBehavior] = useState("");
  const [behaviorFunction, setBehaviorFunction] = useState<BehaviorFunction>("attention");
  const [fbaBasis, setFbaBasis] = useState<FbaBasis[]>([]);
  const [antecedentStrategies, setAntecedentStrategies] = useState("");
  const [replacementBehavior, setReplacementBehavior] = useState("");
  const [reinforcementPlan, setReinforcementPlan] = useState("");
  const [crisisProcedure, setCrisisProcedure] = useState("");
  const [reviewDate, setReviewDate] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const student = useMemo(
    () => students.find((s) => s.personId === personId) ?? null,
    [students, personId]
  );

  const valid =
    Boolean(personId) &&
    targetBehavior.trim().length > 0 &&
    antecedentStrategies.trim().length > 0 &&
    replacementBehavior.trim().length > 0 &&
    reinforcementPlan.trim().length > 0 &&
    reviewDate.length > 0;

  async function save() {
    if (!valid) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: BipInput = {
      target_behavior: targetBehavior.trim(),
      behavior_function: behaviorFunction,
      ...(fbaBasis.length > 0 ? { fba_basis: fbaBasis } : {}),
      antecedent_strategies: antecedentStrategies.trim(),
      replacement_behavior: replacementBehavior.trim(),
      reinforcement_plan: reinforcementPlan.trim(),
      ...(crisisProcedure.trim() ? { crisis_procedure: crisisProcedure.trim() } : {}),
      review_date: reviewDate,
    };
    const res = await createBip(personId, input);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push("/records/bip");
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">행동중재계획(BIP) 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 학생이 없어 행동중재계획을 작성할 수 없습니다. 보호자가 교육(EDU) 도메인 작성 권한을
          부여하면 해당 학생의 BIP를 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        행동중재계획(BIP) 작성{" "}
        <span className="text-body font-medium text-muted-foreground">EDU-003</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        기능평가(FBA)에 기반해 대상 행동·대체행동·강화 계획을 기록하는 공식 지원계획 문서입니다.
        {student && <StageBadge lifeStage={student.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        {/* 2026-07-20: 단일 카드에 전 필드를 몰아넣던 구조를 IEP·ISP처럼 여러 개의 fieldset
            카드로 분리 — 사용자가 지적한 "IEP·ISP 스타일 그대로 활용" 요청 반영. */}
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">기본 정보</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="대상 학생" required>
              <select
                className={fieldClass}
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                {students.map((s) => (
                  <option key={s.personId} value={s.personId}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="행동 기능 (FBA)" required>
              <ChoiceGroup
                ariaLabel="행동 기능"
                value={behaviorFunction}
                onChange={setBehaviorFunction}
                options={BEHAVIOR_FUNCTIONS}
                columns={2}
              />
            </Field>
          </div>
          <p className="-mt-1 text-caption text-muted-foreground">
            {BEHAVIOR_FUNCTIONS.find((f) => f.value === behaviorFunction)?.hint}
          </p>

          <Field label="기능평가 근거 (선택, 복수선택 가능)">
            <ChoiceCheckGroup
              ariaLabel="기능평가 근거"
              value={fbaBasis}
              onChange={setFbaBasis}
              options={FBA_BASIS_OPTIONS}
              columns={2}
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">중재 계획</legend>
          <Field label="중재 대상 행동" required>
            <textarea
              className={`${fieldClass} min-h-20`}
              value={targetBehavior}
              onChange={(e) => setTargetBehavior(e.target.value)}
              maxLength={2000}
              placeholder="중재가 필요한 문제 행동을 관찰 가능한 용어로 구체적으로 기술하세요."
            />
          </Field>

          <Field label="선행사건 중재 전략" required>
            <textarea
              className={`${fieldClass} min-h-24`}
              value={antecedentStrategies}
              onChange={(e) => setAntecedentStrategies(e.target.value)}
              maxLength={3000}
              placeholder="문제 행동을 유발하는 선행사건을 조정·예방하기 위한 전략을 기록하세요."
            />
          </Field>

          <Field label="대체행동" required>
            <textarea
              className={`${fieldClass} min-h-20`}
              value={replacementBehavior}
              onChange={(e) => setReplacementBehavior(e.target.value)}
              maxLength={2000}
              placeholder="같은 기능을 수행하되 사회적으로 수용 가능한 대체행동을 기록하세요."
            />
          </Field>

          <Field label="강화 계획" required>
            <textarea
              className={`${fieldClass} min-h-24`}
              value={reinforcementPlan}
              onChange={(e) => setReinforcementPlan(e.target.value)}
              maxLength={3000}
              placeholder="대체행동을 촉진할 강화물·강화 일정·소거 절차 등을 기록하세요."
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">위기대응·재검토</legend>
          <Field label="위기대응 절차 (선택)">
            <textarea
              className={`${fieldClass} min-h-20`}
              value={crisisProcedure}
              onChange={(e) => setCrisisProcedure(e.target.value)}
              maxLength={3000}
              placeholder="심각한 위기 행동 발생 시 안전 확보 절차를 기록하세요. (경도 사례는 비워둘 수 있습니다)"
            />
          </Field>

          <Field label="재검토 예정일" required>
            <DateField className={fieldClass} value={reviewDate} onChange={setReviewDate} />
          </Field>
        </fieldset>
      </div>

      {/* 오른쪽 사이드바(lg:sticky) — 확인 요청 대상 안내·액션 버튼을 스크롤 중에도 계속
          접근 가능하게 둔다(2026-07-20, JournalWizard와 동일 원칙). */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="rounded-xl bg-domain-edu-bg p-4 text-body text-domain-edu-text ring-1 ring-domain-edu-accent/30">
          ✅ 행동중재계획은 공식 지원계획 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다.
          <span className="mt-2 block font-bold">
            📋 확인 요청 대상:{" "}
            {student && isSelfConfirmingStage(student.lifeStage) ? "본인" : "보호자"}
          </span>
        </div>

        {error && (
          <p role="alert" className="text-body font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
          <TargetPersonBanner name={student?.fullName} />
          <Button
            type="button"
            className="h-11 bg-domain-edu-accent font-bold text-domain-edu-text"
            disabled={busy}
            onClick={save}
          >
            {busy ? "저장 중..." : "행동중재계획 저장"}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => router.push("/records/bip")}>
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
