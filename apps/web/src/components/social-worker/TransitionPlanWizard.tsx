"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoadmapStage, TransitionPlanInput } from "@ongil/validation";
import {
  createTransitionPlan,
  type TransitionClient,
} from "@/app/(app)/records/transition/actions";
import { getLatestItpSummary, type ItpReferenceSummary } from "@/app/(app)/records/itp/actions";
import { DateField } from "@/components/form/DateField";
import { ChoiceGroup } from "@/components/form/ChoiceGroup";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { RoadmapProgress } from "@/components/social-worker/RoadmapProgress";
import { Button } from "@/components/ui/button";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";
import { isPreTransitionStage, isSelfConfirmingStage } from "@/lib/lifecycle";

/**
 * W-16 전환계획(TRA-001) 작성 — 대상·진로·훈련이력·연계·검토를 한 화면에서 입력한다
 * (2026-07-19, 기존 4단계 위저드를 병합해 대체). 만 13세 미만(영유아기·아동기)은
 * 폼을 렌더하지 않고 안내 메시지로 막는다(docs/02-ia.md §3-9 진입가드 — 서버가
 * 최종 방어선이지만 UX상 미리 알린다). 매 제출은 새 레코드 INSERT다(ISP와 동일).
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

const TRAINING_STATUS_LABEL: Record<TrainingDraft["status"], string> = {
  planned: "예정",
  ongoing: "진행중",
  completed: "완료",
};

interface TrainingDraft {
  program: string;
  provider: string;
  start: string;
  end: string;
  status: "planned" | "ongoing" | "completed";
}

function emptyTraining(): TrainingDraft {
  return { program: "", provider: "", start: "", end: "", status: "planned" };
}

export function TransitionPlanWizard({
  clients,
  initialPersonId,
}: {
  clients: TransitionClient[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [personId, setPersonId] = usePersonSelection(clients, initialPersonId);

  const [careerGoal, setCareerGoal] = useState("");
  const [roadmapStage, setRoadmapStage] = useState<RoadmapStage>("exploration");
  const [independentLivingPlan, setIndependentLivingPlan] = useState("");
  const [trainings, setTrainings] = useState<TrainingDraft[]>([emptyTraining()]);
  const [linkedAgencies, setLinkedAgencies] = useState("");
  const [caseManager, setCaseManager] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );
  const blocked = client ? isPreTransitionStage(client.lifeStage) : false;

  const [itpRef, setItpRef] = useState<ItpReferenceSummary | null>(null);
  useEffect(() => {
    setItpRef(null);
    if (!personId) return;
    let cancelled = false;
    getLatestItpSummary(personId).then((r) => {
      if (!cancelled) setItpRef(r);
    });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  function updateTraining(i: number, patch: Partial<TrainingDraft>) {
    setTrainings((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  function buildInput(): TransitionPlanInput {
    const trainingRecords = trainings
      .filter((t) => t.program.trim() || t.provider.trim())
      .map((t) => ({
        program: t.program.trim(),
        provider: t.provider.trim(),
        period: { start: t.start.trim(), end: t.end.trim() },
        status: t.status,
      }));

    const agencies = linkedAgencies
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean);

    return {
      roadmap_stage: roadmapStage,
      career_goal: careerGoal.trim(),
      independent_living_plan: independentLivingPlan.trim() || undefined,
      training_records: trainingRecords,
      linked_agencies: agencies.length ? agencies : undefined,
      case_manager: caseManager.trim(),
      next_review_date: nextReviewDate,
    };
  }

  const canSubmit = Boolean(
    personId && !blocked && careerGoal.trim() && caseManager.trim() && nextReviewDate
  );

  async function submit() {
    if (!canSubmit) {
      setError("당사자·희망 진로·담당자·다음 검토일을 모두 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createTransitionPlan(personId, buildInput());
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    // "/home"은 role별 분기라 보호자가 직접 이 폼을 쓸 때(2026-07-19, 구조화 기록 보호자 개방)
    // "다음 단계에서 제공됩니다" 안내만 뜨는 막다른 길이 된다 — role 무관하게 항상 유효한
    // 타임라인으로 보낸다(getTimeline은 RLS만으로 걸러지는 범용 조회).
    router.push(`/timeline?personId=${personId}`);
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">전환계획 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 당사자가 없어 전환계획을 작성할 수 없습니다. 보호자가 전환(TRA) 도메인 작성 권한을
          부여하면 해당 당사자의 전환계획을 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        전환계획 작성{" "}
        <span className="text-body font-medium text-muted-foreground">TRA</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {client ? `${client.fullName} 당사자` : "당사자를 선택하세요"}
        {client && <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">대상·진로</legend>
          <Field label="대상 당사자" required>
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
              🧒 만 13세 이상부터 전환계획을 작성할 수 있습니다. 이 당사자는 아직 영유아기·아동기 단계라
              전환계획 대상이 아닙니다.
            </div>
          ) : (
            <>
              <Field label="희망 진로" required>
                <input
                  className={fieldClass}
                  value={careerGoal}
                  onChange={(e) => setCareerGoal(e.target.value)}
                  placeholder="예: 바리스타 직무로 취업"
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-label font-semibold text-accent-stone">
                  로드맵 단계 <span className="text-domain-med-text">*</span>
                </span>
                <RoadmapProgress stage={roadmapStage} onChange={setRoadmapStage} />
              </div>
              <Field label="자립생활 계획 (선택)">
                <textarea
                  className={`${fieldClass} min-h-28`}
                  value={independentLivingPlan}
                  onChange={(e) => setIndependentLivingPlan(e.target.value)}
                  placeholder="주거·금전관리·이동 등 자립생활 관련 계획을 기록하세요"
                />
              </Field>
            </>
          )}
        </fieldset>

        {!blocked && (
          <>
            <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
              <legend className="text-sm font-bold text-foreground">훈련 이력 (선택)</legend>
              <p className="text-body text-muted-foreground">
                직업훈련·프로그램 이력을 입력합니다. 제공기관·기간·진행 상태를 기록하세요.
              </p>
              {trainings.map((t, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-label font-bold text-domain-tra-text">훈련 {i + 1}</span>
                    {trainings.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 px-3"
                        onClick={() => setTrainings((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`훈련 ${i + 1} 삭제`}
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                  <Field label="프로그램">
                    <input
                      className={fieldClass}
                      value={t.program}
                      onChange={(e) => updateTraining(i, { program: e.target.value })}
                      placeholder="예: 바리스타 직무훈련"
                    />
                  </Field>
                  <Field label="제공기관">
                    <input
                      className={fieldClass}
                      value={t.provider}
                      onChange={(e) => updateTraining(i, { provider: e.target.value })}
                      placeholder="예: OO직업재활센터"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="시작일">
                      <DateField
                        className={fieldClass}
                        value={t.start}
                        onChange={(v) => updateTraining(i, { start: v })}
                        max={t.end || undefined}
                      />
                    </Field>
                    <Field label="종료일">
                      <DateField
                        className={fieldClass}
                        value={t.end}
                        onChange={(v) => updateTraining(i, { end: v })}
                        min={t.start || undefined}
                      />
                    </Field>
                  </div>
                  <Field label="진행 상태">
                    <ChoiceGroup
                      ariaLabel="진행 상태"
                      value={t.status}
                      onChange={(v) => updateTraining(i, { status: v })}
                      columns={3}
                      options={(["planned", "ongoing", "completed"] as const).map((s) => ({
                        value: s,
                        label: TRAINING_STATUS_LABEL[s],
                      }))}
                    />
                  </Field>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setTrainings((prev) => [...prev, emptyTraining()])}
              >
                ＋ 훈련 이력 추가
              </Button>
            </fieldset>

            <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
              <legend className="text-sm font-bold text-foreground">연계·검토</legend>
              <Field label="연계 기관 (선택, 한 줄에 하나)">
                <textarea
                  className={`${fieldClass} min-h-24`}
                  value={linkedAgencies}
                  onChange={(e) => setLinkedAgencies(e.target.value)}
                  placeholder={"예:\n한국장애인고용공단\nOO발달장애인지원센터"}
                />
              </Field>
              <Field label="담당자(사례관리자)" required>
                <input
                  className={fieldClass}
                  value={caseManager}
                  onChange={(e) => setCaseManager(e.target.value)}
                  placeholder="예: 최복지 사회복지사"
                />
              </Field>
              <Field label="다음 검토일" required>
                <DateField className={fieldClass} value={nextReviewDate} onChange={setNextReviewDate} />
              </Field>
            </fieldset>

          </>
        )}
      </div>

      {/* 오른쪽 사이드바(lg:sticky) — 기존 전환계획·학교 ITP 참고·확인 요청 대상 안내·액션
          버튼을 스크롤 중에도 계속 접근 가능하게 둔다(2026-07-20, JournalWizard와 동일 원칙). */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        {client?.latestPlan && (
          <div className="flex flex-col gap-2 rounded-xl border border-domain-tra-accent/40 bg-domain-tra-bg/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label font-bold text-domain-tra-text">기존 전환계획</span>
              {client.latestPlan.requiresConfirmation && (
                <ConfirmBadge confirmedAt={client.latestPlan.confirmedAt} />
              )}
            </div>
            {client.latestPlan.roadmapStage && (
              <RoadmapProgress stage={client.latestPlan.roadmapStage} />
            )}
            <p className="text-caption text-muted-foreground">
              새 전환계획을 작성하면 별도 기록으로 저장됩니다(기존 계획은 유지).
            </p>
          </div>
        )}

        {itpRef && (
          <div className="flex flex-col gap-1 rounded-xl border border-domain-edu-accent/40 bg-domain-edu-bg/50 p-4">
            <span className="text-label font-bold text-domain-edu-text">
              🎓 참고 — 학교 개별화전환계획(ITP)
            </span>
            <p className="text-caption text-muted-foreground">
              진로 흥미영역: {itpRef.careerInterestAreas.join(", ") || "-"} · 다음 검토일{" "}
              {itpRef.nextReviewDate ?? "-"}
            </p>
          </div>
        )}

        {!blocked && (
          <div className="rounded-xl bg-domain-tra-bg p-4 text-body text-domain-tra-text ring-1 ring-domain-tra-accent/30">
            ✅ 전환계획은 공식 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다. 저장 후 당사자
            타임라인에 기록됩니다.
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
            className="h-11 bg-primary-600 font-bold"
            disabled={busy || blocked || !canSubmit}
            onClick={submit}
          >
            {busy ? "저장 중..." : "전환계획 저장"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => router.push(personId ? `/timeline?personId=${personId}` : "/home")}
          >
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
