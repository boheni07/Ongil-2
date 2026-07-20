"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  TherapyArea,
  TherapyDomainScores,
  SessionNoteInput,
} from "@ongil/validation";
import {
  createSessionNote,
  type SessionComposeContext,
} from "@/app/(app)/records/therapy/actions";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/form/DateField";

/**
 * TH-15 회기 일지 작성(프로토타입 web-therapist.html 293~348줄).
 * 서버 페이지가 getSessionComposeContext(personId)를 미리 호출해 context로 넘겨준다 —
 * "치료계획 자동연결"의 결과(therapyPlanId·planGoals·sessionNumber·previousSession)를 진입 시점에
 * 이미 알고 있어야 "계획 vs 실제 비교" 패널을 처음부터 그릴 수 있기 때문이다.
 * 프로토타입은 신체/언어/인지 1~5 dot + 사회성 range였으나, 4개 영역 모두 0~100 슬라이더로 통일했다.
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

const AREA_META: { key: TherapyArea; icon: string; label: string }[] = [
  { key: "physical", icon: "🖐", label: "신체 (구강운동)" },
  { key: "language", icon: "💬", label: "언어" },
  { key: "cognitive", icon: "🧠", label: "인지" },
  { key: "social", icon: "🤝", label: "사회성" },
];

const AREA_LABEL: Record<TherapyArea, string> = {
  physical: "신체 (구강운동)",
  language: "언어",
  cognitive: "인지",
  social: "사회성",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SessionNoteForm({
  personId,
  personName,
  context,
}: {
  personId: string;
  personName: string;
  context: SessionComposeContext;
}) {
  const router = useRouter();

  const [sessionDate, setSessionDate] = useState(today());
  const [actualProgress, setActualProgress] = useState("");
  const [observations, setObservations] = useState("");
  const [nextSessionPlan, setNextSessionPlan] = useState("");
  const [scores, setScores] = useState<TherapyDomainScores>(
    context.previousSession?.domainScores ?? {
      physical: 50,
      language: 50,
      cognitive: 50,
      social: 50,
    }
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 자동연결된 계획서가 없으면 회기 일지를 작성할 수 없다(therapy_plan_id 필수).
  if (!context.therapyPlanId) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">회기 일지 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          {personName} 아동에게 연결할 확정된 치료계획서가 없습니다. 회기 일지는 치료계획서에
          연동되므로 먼저 계획서를 작성해주세요.
        </p>
        <Button
          className="mt-4 h-11 bg-primary-600 font-bold"
          render={<Link href={`/records/therapy-plan/new?personId=${personId}`} />}
        >
          ＋ 치료계획서 작성
        </Button>
      </div>
    );
  }

  const planId = context.therapyPlanId;

  function setScore(area: TherapyArea, value: number) {
    setScores((prev) => ({ ...prev, [area]: value }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const input: SessionNoteInput & { personId: string } = {
      personId,
      session_date: sessionDate,
      therapy_plan_id: planId,
      session_number: context.sessionNumber,
      planned_goals: context.planGoals.map((g) => g.short_term || g.long_term).filter(Boolean),
      actual_progress: actualProgress.trim(),
      domain_scores: scores,
      observations: observations.trim(),
      ...(nextSessionPlan.trim() ? { next_session_plan: nextSessionPlan.trim() } : {}),
    };
    const res = await createSessionNote(input);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(`/records/therapy-plan/${planId}`);
    router.refresh();
  }

  const shortPlanId = `THP-${planId.slice(0, 8)}`;

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">회기 일지 작성</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {personName} · {context.sessionNumber}회기차 · {sessionDate}
          </p>
        </div>
        <span className="rounded-(--br-sm) bg-domain-med-bg px-3 py-1.5 text-caption font-bold text-domain-med-text">
          🔗 계획서 {shortPlanId} 자동 연결됨
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex flex-col gap-4">
          {/* 회기 활동 기록 */}
          <section className="flex flex-col gap-3 rounded-xl bg-white p-5 ring-1 ring-foreground/10">
            <h2 className="text-label font-bold text-accent-stone">회기 활동 기록</h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-semibold text-accent-stone">
                회기 일자 <span className="text-domain-med-text">*</span>
              </span>
              <DateField className={`${fieldClass} w-48`} value={sessionDate} onChange={setSessionDate} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-semibold text-accent-stone">
                주요 활동 내용 <span className="text-domain-med-text">*</span>
              </span>
              <textarea
                className={`${fieldClass} min-h-24`}
                value={actualProgress}
                onChange={(e) => setActualProgress(e.target.value)}
                placeholder="그림카드를 활용한 2어절 표현 유도. 구강 운동 워밍업 5분 후 범주화 놀이 진행."
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-label font-semibold text-accent-stone">
                아동 반응·특이사항 <span className="text-domain-med-text">*</span>
              </span>
              <textarea
                className={`${fieldClass} min-h-24`}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder='"큰 공", "빨간 차" 등 자발 산출 8회 관찰. 후반부 집중 저하.'
              />
            </label>
          </section>

          {/* 계획 vs 실제 비교 */}
          <section className="flex flex-col gap-3 rounded-xl bg-white p-5 ring-1 ring-foreground/10">
            <h2 className="text-label font-bold text-accent-stone">계획 vs 실제 비교</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-(--br-md) bg-muted/50 p-3">
                <h3 className="text-caption font-bold text-muted-foreground">계획 (목표)</h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {context.planGoals.length === 0 ? (
                    <li className="text-body text-muted-foreground">등록된 목표가 없습니다.</li>
                  ) : (
                    context.planGoals.map((g, i) => (
                      <li key={i} className="text-body text-foreground">
                        <span className="font-semibold text-domain-med-text">
                          {AREA_LABEL[g.area]}
                        </span>
                        {": "}
                        {g.short_term || g.long_term || "-"}
                        {g.target_score != null ? ` (목표 ${g.target_score}%)` : ""}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-(--br-md) bg-domain-med-bg p-3">
                <h3 className="text-caption font-bold text-domain-med-text">실제 (오늘)</h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {AREA_META.map(({ key, label }) => (
                    <li key={key} className="text-body text-foreground">
                      <span className="font-semibold text-domain-med-text">{label}</span>
                      {": "}
                      <b>{scores[key]}%</b>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 영역별 달성도 체크 */}
          <section className="flex flex-col gap-4 rounded-xl bg-white p-5 ring-1 ring-foreground/10">
            <h2 className="text-label font-bold text-accent-stone">영역별 달성도 체크</h2>
            {AREA_META.map(({ key, icon, label }) => {
              const prev = context.previousSession?.domainScores[key];
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`score-${key}`}
                    className="flex items-center justify-between text-body font-semibold text-foreground"
                  >
                    <span>
                      <span aria-hidden="true">{icon}</span> {label}
                    </span>
                    <span className="text-domain-med-text">{scores[key]}%</span>
                  </label>
                  <input
                    id={`score-${key}`}
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={scores[key]}
                    onChange={(e) => setScore(key, Number(e.target.value))}
                    className="h-2 w-full cursor-pointer accent-domain-med-accent"
                    aria-valuetext={`${scores[key]} 퍼센트`}
                  />
                  {prev != null && (
                    <span className="text-caption text-muted-foreground">
                      직전 회기 {prev}% → 이번 {scores[key]}%
                    </span>
                  )}
                </div>
              );
            })}

            <label className="flex flex-col gap-1.5">
              <span className="text-label font-semibold text-accent-stone">다음 회기 계획 (선택)</span>
              <textarea
                className={`${fieldClass} min-h-20`}
                value={nextSessionPlan}
                onChange={(e) => setNextSessionPlan(e.target.value)}
                maxLength={2000}
                placeholder="다음 회기에 이어갈 활동·조정 사항을 기록하세요"
              />
            </label>
          </section>
        </div>

        {/* 우측: 치료 목표(계획 연동) 사이드바 */}
        <aside className="flex flex-col gap-3 rounded-xl bg-white p-5 ring-1 ring-foreground/10 lg:sticky lg:top-6">
          <h2 className="text-label font-bold text-accent-stone">🎯 치료 목표 (계획 연동)</h2>
          {context.planGoals.length === 0 ? (
            <p className="text-body text-muted-foreground">연결된 목표가 없습니다.</p>
          ) : (
            context.planGoals.map((g, i) => {
              const prev = context.previousSession?.domainScores[g.area];
              return (
                <div key={i} className="flex flex-col gap-1 rounded-(--br-md) bg-muted/40 p-3">
                  <span className="text-caption font-bold text-domain-med-text">
                    {AREA_LABEL[g.area]}
                  </span>
                  <span className="text-body text-foreground">{g.long_term || "-"}</span>
                  <span className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-domain-med-accent"
                      style={{ width: `${prev ?? 0}%` }}
                    />
                  </span>
                  <span className="text-caption text-muted-foreground">
                    목표 {g.target_score != null ? `${g.target_score}%` : "-"} · 직전{" "}
                    {prev != null ? `${prev}%` : "미평가"}
                  </span>
                </div>
              );
            })
          )}
        </aside>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          render={<Link href={`/records/therapy-plan/${planId}`} />}
        >
          ← 계획서
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          className="h-11 bg-primary-600 font-bold"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "저장 중..." : "회기 일지 저장"}
        </Button>
      </div>
    </div>
  );
}
