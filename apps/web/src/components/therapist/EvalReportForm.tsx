"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TherapyArea, EvalReportInput } from "@ongil/validation";
import {
  getEvalComposeContext,
  createEvalReport,
  getEvalComparison,
  type EvalComposeContext,
  type EvalComparison,
  type EvalType,
} from "@/app/(app)/records/eval/actions";
import type { TherapistClient } from "@/app/(app)/records/therapy/actions";
import { computeAge } from "@/lib/lifecycle";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/form/DateField";
import { EvalComparisonTable } from "./EvalComparisonTable";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";

/**
 * TH-17 평가보고서 작성(/records/eval/new, docs/04-workflow.md Flow-TH-02).
 * 당사자 선택 → getEvalComposeContext로 치료계획서(MED-005)를 자동 연결한다.
 * therapyPlanId가 null이면 폼 대신 TH-13 작성 안내로 대체한다(평가보고서는 계획서에 종속).
 * 4개 영역 점수(신체/언어/인지/사회성 0~100)·요약·권고사항을 입력해 createEvalReport로 저장하고,
 * 저장 성공 시 같은 therapy_plan_id의 3열 비교 뷰(getEvalComparison)를 즉시 다시 불러온다.
 * 영역 라벨은 SessionNoteForm/TherapyPlanWizard와 동일하게 통일한다.
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

const AREA_META: { key: TherapyArea; icon: string; label: string }[] = [
  { key: "physical", icon: "🖐", label: "신체 (구강운동)" },
  { key: "language", icon: "💬", label: "언어" },
  { key: "cognitive", icon: "🧠", label: "인지" },
  { key: "social", icon: "🤝", label: "사회성" },
];

const EVAL_TYPES: { value: EvalType; label: string }[] = [
  { value: "initial", label: "초기 평가" },
  { value: "interim", label: "중간 평가" },
  { value: "final", label: "최종 평가" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstUnsubmitted(existing: EvalType[]): EvalType {
  return EVAL_TYPES.find((t) => !existing.includes(t.value))?.value ?? "initial";
}

export function EvalReportForm({
  clients,
  initialPersonId,
}: {
  clients: TherapistClient[];
  initialPersonId?: string;
}) {
  const [personId, setPersonId] = usePersonSelection(clients, initialPersonId);

  const [context, setContext] = useState<EvalComposeContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [evalType, setEvalType] = useState<EvalType>("initial");
  const [evalDate, setEvalDate] = useState(today());
  const [scores, setScores] = useState<Record<TherapyArea, string>>({
    physical: "50",
    language: "50",
    cognitive: "50",
    social: "50",
  });
  const [summary, setSummary] = useState("");
  const [recommendations, setRecommendations] = useState("");

  const [comparison, setComparison] = useState<EvalComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = clients.find((c) => c.personId === personId) ?? null;

  // 당사자가 바뀌면 치료계획서 자동연결 컨텍스트 + 기존 비교 뷰를 다시 조회한다.
  useEffect(() => {
    if (!personId) {
      setContext(null);
      setComparison(null);
      return;
    }
    let cancelled = false;
    setLoadingContext(true);
    setError(null);
    getEvalComposeContext(personId).then(async (ctx) => {
      if (cancelled) return;
      setContext(ctx);
      setEvalType(firstUnsubmitted(ctx.existingEvalTypes));
      setComparison(ctx.therapyPlanId ? await getEvalComparison(ctx.therapyPlanId, personId) : null);
      if (!cancelled) setLoadingContext(false);
    });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  function setScore(area: TherapyArea, value: string) {
    setScores((prev) => ({ ...prev, [area]: value }));
  }

  async function submit() {
    if (!context?.therapyPlanId) return;
    setBusy(true);
    setError(null);
    const input: EvalReportInput = {
      eval_type: evalType,
      eval_date: evalDate,
      therapy_plan_id: context.therapyPlanId,
      domain_scores: AREA_META.map((a) => ({
        domain: a.key,
        score: Math.round(Number(scores[a.key])),
      })),
      summary: summary.trim(),
      ...(recommendations.trim() ? { recommendations: recommendations.trim() } : {}),
    };
    const res = await createEvalReport(personId, input);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    // 저장 즉시 비교 뷰 갱신 + 방금 제출한 단계를 existing에 반영.
    const [cmp, freshCtx] = await Promise.all([
      getEvalComparison(context.therapyPlanId, personId),
      getEvalComposeContext(personId),
    ]);
    setComparison(cmp);
    setContext(freshCtx);
    setSummary("");
    setRecommendations("");
    setBusy(false);
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">평가보고서 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 아동이 없어 평가보고서를 작성할 수 없습니다. 보호자가 의료(MED) 도메인 작성 권한을
          부여하면 해당 아동의 평가보고서를 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  const noPlan = !loadingContext && context !== null && context.therapyPlanId === null;
  const canSubmit =
    !busy && !loadingContext && !!context?.therapyPlanId && summary.trim().length > 0;

  return (
    <div className="mx-auto flex w-full min-h-full max-w-6xl flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">평가보고서 작성</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
            {client
              ? `${client.fullName} (만 ${computeAge(client.birthDate)}세)`
              : "아동을 선택하세요"}
            {client && (
              <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />
            )}
          </p>
        </div>
        {context?.therapyPlanId && (
          <span className="rounded-(--br-sm) bg-domain-med-bg px-3 py-1.5 text-caption font-bold text-domain-med-text">
            🔗 계획서 THP-{context.therapyPlanId.slice(0, 8)} 자동 연결됨
          </span>
        )}
      </div>

      {/* 2026-07-20: 기록 작성화면의 와이드 레이아웃 기준을 IEP(EDU-001)로 통일 — 짧은 일상
          기록도 예외를 두지 않고 동일한 max-w-6xl + 1fr/340px 사이드바 구조를 쓴다. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
            <legend className="text-sm font-bold text-foreground">대상·평가 단계</legend>
            {/* 대상 아동 선택 */}
            <label className="flex max-w-md flex-col gap-1.5">
              <span className="text-label font-semibold text-accent-stone">
                대상 아동 <span className="text-domain-med-text">*</span>
              </span>
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
            </label>

            {loadingContext && (
              <p className="text-body text-muted-foreground">치료계획서를 확인하는 중…</p>
            )}

            {noPlan && (
              <div className="rounded-xl bg-accent-amber/15 p-5 ring-1 ring-accent-amber/40">
                <p className="text-body font-semibold text-[#B56F10]">
                  연결할 확정 치료계획서가 없습니다.
                </p>
                <p className="mt-1 text-body text-muted-foreground">
                  평가보고서는 치료계획서(TH-13)에 연동됩니다. 먼저 치료계획서를 작성해주세요.
                </p>
                <Button
                  className="mt-4 h-11 bg-primary-600 font-bold"
                  render={<Link href={`/records/therapy-plan/new?personId=${personId}`} />}
                >
                  ＋ 치료계획서 작성
                </Button>
              </div>
            )}

            {context?.therapyPlanId && !loadingContext && (
              <>
                {/* 평가 단계 */}
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-label font-semibold text-accent-stone">
                    평가 단계 <span className="text-domain-med-text">*</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {EVAL_TYPES.map((t) => {
                      const submitted = context.existingEvalTypes.includes(t.value);
                      const active = evalType === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          disabled={submitted}
                          onClick={() => setEvalType(t.value)}
                          aria-pressed={active}
                          className={`min-h-11 rounded-(--br-md) border px-4 py-2 text-body font-semibold transition-colors ${
                            active
                              ? "border-primary-600 bg-primary-50 text-primary-700"
                              : submitted
                                ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground"
                                : "border-border bg-white text-foreground hover:bg-muted/50"
                          }`}
                        >
                          {t.label}
                          {submitted && (
                            <span className="ml-1.5 text-caption font-medium text-muted-foreground">
                              · 제출됨
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* 평가 일자 */}
                <label className="flex max-w-xs flex-col gap-1.5">
                  <span className="text-label font-semibold text-accent-stone">
                    평가 일자 <span className="text-domain-med-text">*</span>
                  </span>
                  <DateField className={fieldClass} value={evalDate} onChange={setEvalDate} />
                </label>
              </>
            )}
          </fieldset>

          {/* 기존 3열 비교 뷰(작성 전후 모두 노출) */}
          {comparison && (
            <fieldset className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
              <legend className="text-sm font-bold text-foreground">평가 변화 비교 (초기·중간·최종)</legend>
              <EvalComparisonTable comparison={comparison} />
            </fieldset>
          )}

          {context?.therapyPlanId && !loadingContext && (
            <>
              {/* 영역별 점수 */}
              <fieldset className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
                <legend className="text-sm font-bold text-foreground">
                  영역별 평가 점수 (0~100)
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {AREA_META.map(({ key, icon, label }) => (
                    <label key={key} className="flex flex-col gap-1.5">
                      <span className="text-label font-semibold text-domain-med-text">
                        <span aria-hidden="true">{icon}</span> {label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className={fieldClass}
                        value={scores[key]}
                        onChange={(e) => setScore(key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* 종합 요약·권고사항 */}
              <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
                <legend className="text-sm font-bold text-foreground">종합 소견</legend>
                <label className="flex flex-col gap-1.5">
                  <span className="text-label font-semibold text-accent-stone">
                    종합 평가 요약 <span className="text-domain-med-text">*</span>
                  </span>
                  <textarea
                    className={`${fieldClass} min-h-32`}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    maxLength={3000}
                    placeholder="평가 기간 동안의 전반적 변화, 강점·보완 영역, 목표 달성 정도를 종합해 기록하세요."
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-label font-semibold text-accent-stone">향후 권고사항 (선택)</span>
                  <textarea
                    className={`${fieldClass} min-h-24`}
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    maxLength={2000}
                    placeholder="다음 치료 방향, 가정·기관 연계 권고, 재평가 시점 등을 기록하세요."
                  />
                </label>
              </fieldset>
            </>
          )}
        </div>

        {/* 오른쪽 사이드바(lg:sticky) — 확인 요청 대상 안내·액션 버튼을 스크롤 중에도 계속
            접근 가능하게 둔다(2026-07-20, JournalWizard와 동일한 원칙). */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
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
              disabled={!canSubmit}
              onClick={submit}
            >
              {busy ? "저장 중..." : "평가보고서 저장"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              render={<Link href="/home" />}
            >
              ← 홈
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
