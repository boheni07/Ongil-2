"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ItpInput } from "@ongil/validation";
import { createItp, type ItpClient } from "@/app/(app)/records/itp/actions";
import { DateField } from "@/components/form/DateField";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { Button } from "@/components/ui/button";
import { isItpActiveStage, isSelfConfirmingStage } from "@/lib/lifecycle";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";

/**
 * T-19 개별화전환계획(ITP, EDU-005) 작성 — 대상·흥미영역·현장실습이력·인계메모·검토일을
 * 한 화면에서 입력한다(2026-07-19, 기존 4단계 위저드를 병합해 대체 — TransitionPlanWizard와
 * 동일 구조). ITP는 청소년 전환기(만 13~18세)에만 활성 — 그 외 단계는 폼을 렌더하지 않고
 * 안내로 막는다(isItpActiveStage, TRA-001의 isPreTransitionStage 가드와 동형).
 * 매 제출은 새 레코드 INSERT다(기존 레코드 수정 아님 — IEP/ISP/전환계획과 동일).
 * TRA-001(사회복지사)과는 별개 레코드이며 person_id로만 느슨하게 연결된다(FK 없음).
 */

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
  const [personId, setPersonId] = usePersonSelection(clients, initialPersonId);

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

  const canSubmit = Boolean(personId && !blocked && areasText.trim() && nextReviewDate);

  async function submit() {
    if (!canSubmit) {
      setError("학생·진로 흥미영역·다음 검토일을 모두 입력해주세요.");
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
    <div className="mx-auto flex min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        개별화전환계획(ITP) 작성{" "}
        <span className="text-body font-medium text-muted-foreground">EDU-005</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {client ? `${client.fullName} 학생` : "학생을 선택하세요"}
        {client && <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">대상·흥미영역</legend>
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
        </fieldset>

        {!blocked && (
          <>
            <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
              <legend className="text-sm font-bold text-foreground">현장실습 이력 (선택)</legend>
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
            </fieldset>

            <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
              <legend className="text-sm font-bold text-foreground">인계메모·검토일</legend>
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
            </fieldset>

          </>
        )}
      </div>

      {/* 오른쪽 사이드바(lg:sticky) — 기존 ITP 요약·확인 요청 대상 안내·액션 버튼을 스크롤
          중에도 계속 접근 가능하게 둔다(2026-07-20, JournalWizard와 동일한 원칙). */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        {client?.latestItp && (
          <div className="flex flex-col gap-2 rounded-xl border border-domain-edu-accent/40 bg-domain-edu-bg/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label font-bold text-domain-edu-text">기존 ITP</span>
              {client.latestItp.requiresConfirmation && (
                <ConfirmBadge confirmedAt={client.latestItp.confirmedAt} />
              )}
            </div>
            <p className="text-caption text-muted-foreground">
              다음 검토일 {client.latestItp.nextReviewDate ?? "-"} · 새 ITP를 작성하면 별도
              기록으로 저장됩니다(기존 계획은 유지).
            </p>
          </div>
        )}

        {!blocked && (
          <div className="rounded-xl bg-domain-edu-bg p-4 text-body text-domain-edu-text ring-1 ring-domain-edu-accent/30">
            ✅ 개별화전환계획은 공식 지원계획 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다.
            <span className="mt-2 block font-bold">
              📋 확인 요청 대상: {client && isSelfConfirmingStage(client.lifeStage) ? "본인" : "보호자"}
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-body font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
          <TargetPersonBanner name={client?.fullName} />
          <Button
            type="button"
            className="h-11 bg-domain-edu-accent font-bold text-white"
            disabled={busy || blocked || !canSubmit}
            onClick={submit}
          >
            {busy ? "저장 중..." : "개별화전환계획 저장"}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => router.push("/records/itp")}>
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
