"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ItpInput } from "@ongil/validation";
import { createItp, type ItpClient } from "@/app/(app)/records/itp/actions";
import { WizardProgress } from "@/components/form/WizardProgress";
import { DateField } from "@/components/form/DateField";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { Button } from "@/components/ui/button";
import { isItpActiveStage, isSelfConfirmingStage } from "@/lib/lifecycle";

/**
 * T-19 개별화전환계획(ITP, EDU-005) 작성 위저드 — TransitionPlanWizard.tsx와 동일 구조.
 * 대상·진로 흥미영역 → 현장실습 이력 → 인계메모·검토일 → 확인·저장.
 * ITP는 청소년 전환기(만 13~18세)에만 활성 — 그 외 단계는 폼을 렌더하지 않고 안내로 막는다
 * (isItpActiveStage, TRA-001의 isPreTransitionStage 가드와 동형 — docs/08 안건2-2).
 * 매 제출은 새 레코드 INSERT다(기존 레코드 수정 아님 — IEP/ISP/전환계획과 동일).
 * TRA-001(사회복지사)과는 별개 레코드이며 person_id로만 느슨하게 연결된다(FK 없음).
 */

const STEP_LABELS = ["대상·흥미영역", "현장실습 이력", "인계메모·검토일", "확인·저장"];

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

interface ExperienceDraft {
  activity: string;
  start: string;
  end: string;
  note: string;
}

function emptyExperience(): ExperienceDraft {
  return { activity: "", start: "", end: "", note: "" };
}

export function ItpWizard({
  clients,
  initialPersonId,
}: {
  clients: ItpClient[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [personId, setPersonId] = useState(
    initialPersonId && clients.some((c) => c.personId === initialPersonId)
      ? initialPersonId
      : clients[0]?.personId ?? ""
  );

  const [areasText, setAreasText] = useState("");
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([emptyExperience()]);
  const [nextStepNote, setNextStepNote] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );
  const blocked = client ? !isItpActiveStage(client.lifeStage) : false;

  function updateExperience(i: number, patch: Partial<ExperienceDraft>) {
    setExperiences((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function buildInput(): ItpInput {
    const areas = areasText
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const workExperienceLog = experiences
      .filter((e) => e.activity.trim())
      .map((e) => ({
        activity: e.activity.trim(),
        period: { start: e.start.trim(), end: e.end.trim() },
        note: e.note.trim() || undefined,
      }));

    return {
      career_interest_areas: areas,
      work_experience_log: workExperienceLog,
      next_step_note: nextStepNote.trim() || undefined,
      next_review_date: nextReviewDate,
    };
  }

  async function submit() {
    if (!personId) {
      setError("학생을 선택해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createItp(personId, buildInput());
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push("/records/itp");
    router.refresh();
  }

  function nextStep() {
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  }
  function prevStep() {
    setError(null);
    if (step === 1) {
      router.push("/records/itp");
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  }

  const canNext =
    (step === 1 && Boolean(personId && !blocked && areasText.trim())) ||
    step === 2 ||
    (step === 3 && Boolean(nextReviewDate));

  if (clients.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">개별화전환계획(ITP) 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 학생이 없어 개별화전환계획을 작성할 수 없습니다. 보호자가 교육(EDU) 도메인 작성
          권한을 부여하면 해당 학생의 ITP를 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        개별화전환계획(ITP) 작성{" "}
        <span className="text-body font-medium text-muted-foreground">EDU-005</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {client ? `${client.fullName} 학생` : "학생을 선택하세요"}
        {client && <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <WizardProgress current={step} total={4} label={STEP_LABELS[step - 1]} className="mt-5 mb-6" />

      {/* 재작성 케이스 — 기존 ITP 요약 */}
      {client?.latestItp && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-domain-edu-accent/40 bg-domain-edu-bg/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label font-bold text-domain-edu-text">기존 ITP</span>
            {client.latestItp.requiresConfirmation && (
              <ConfirmBadge confirmedAt={client.latestItp.confirmedAt} />
            )}
          </div>
          <p className="text-caption text-muted-foreground">
            다음 검토일 {client.latestItp.nextReviewDate ?? "-"} · 아래에서 새 ITP를 작성하면
            별도 기록으로 저장됩니다(기존 계획은 유지).
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Field label="대상 학생" required>
            <select
              className={fieldClass}
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.personId} value={c.personId}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </Field>

          {blocked ? (
            <div className="rounded-(--br-md) bg-domain-med-bg p-4 text-body font-semibold text-domain-med-text">
              🎓 개별화전환계획은 청소년 전환기(만 13~18세)에만 작성할 수 있습니다. 이 학생은 해당
              단계가 아닙니다.
            </div>
          ) : (
            <Field label="진로 흥미영역 (쉼표로 구분)" required>
              <input
                className={fieldClass}
                value={areasText}
                onChange={(e) => setAreasText(e.target.value)}
                placeholder="예: 바리스타, 원예, 사무보조"
              />
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">
            현장실습·직업체험 이력을 입력합니다. (선택)
          </p>
          {experiences.map((e, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-label font-bold text-domain-edu-text">실습 {i + 1}</span>
                {experiences.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 px-3"
                    onClick={() => setExperiences((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`실습 ${i + 1} 삭제`}
                  >
                    삭제
                  </Button>
                )}
              </div>
              <Field label="실습/체험 활동명">
                <input
                  className={fieldClass}
                  value={e.activity}
                  onChange={(ev) => updateExperience(i, { activity: ev.target.value })}
                  placeholder="예: 카페 현장실습"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="시작일">
                  <DateField className={fieldClass} value={e.start} onChange={(v) => updateExperience(i, { start: v })} />
                </Field>
                <Field label="종료일">
                  <DateField className={fieldClass} value={e.end} onChange={(v) => updateExperience(i, { end: v })} />
                </Field>
              </div>
              <Field label="비고 (선택)">
                <input
                  className={fieldClass}
                  value={e.note}
                  onChange={(ev) => updateExperience(i, { note: ev.target.value })}
                />
              </Field>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setExperiences((prev) => [...prev, emptyExperience()])}
          >
            ＋ 실습 이력 추가
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Field label="성인기 인계 메모 (선택)">
            <textarea
              className={`${fieldClass} min-h-28`}
              value={nextStepNote}
              onChange={(e) => setNextStepNote(e.target.value)}
              maxLength={2000}
              placeholder="성인기 전환 시 복지기관(TRA-001)에 전달할 참고 사항을 기록하세요."
            />
          </Field>
          <Field label="다음 검토일" required>
            <DateField className={fieldClass} value={nextReviewDate} onChange={setNextReviewDate} />
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-domain-edu-bg p-4 ring-1 ring-domain-edu-accent/40">
            <SummaryRow k="학생" v={client?.fullName ?? "-"} />
            <SummaryRow k="진로 흥미영역" v={areasText || "-"} />
            <SummaryRow
              k="현장실습 이력"
              v={`${experiences.filter((e) => e.activity.trim()).length}건`}
            />
            <SummaryRow k="다음 검토일" v={nextReviewDate || "-"} last />
          </div>

          <div className="rounded-(--br-md) bg-primary-50 p-4 text-body text-primary-700">
            ✅ 개별화전환계획은 공식 지원계획 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다.
            <span className="mt-2 block font-bold">
              📋 확인 요청 대상: {client && isSelfConfirmingStage(client.lifeStage) ? "본인" : "보호자"}
            </span>
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
        {step < 4 ? (
          <Button type="button" className="h-11" disabled={!canNext} onClick={nextStep}>
            다음 →
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 bg-domain-edu-accent font-bold text-white"
            disabled={busy || blocked}
            onClick={submit}
          >
            {busy ? "저장 중..." : "개별화전환계획 저장"}
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
        last ? "" : "border-b border-domain-edu-accent/25"
      }`}
    >
      <span className="shrink-0 font-semibold text-domain-edu-text">{k}</span>
      <span className="text-right text-foreground">{v}</span>
    </div>
  );
}
