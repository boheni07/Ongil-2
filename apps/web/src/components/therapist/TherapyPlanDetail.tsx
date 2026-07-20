"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TherapyArea, TherapyPlanGoalPatch } from "@ongil/validation";
import { updateTherapyPlanGoal, type TherapyPlanDetail as Detail } from "@/app/(app)/records/therapy/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { Button } from "@/components/ui/button";

/**
 * TH-14 치료계획서 상세(프로토타입 web-therapist.html 268~290줄).
 * 상단: 기본정보(치료 유형·진단·기간·담당·진행 회기) / 하단 Split Pane:
 * 좌 영역별 목표+달성도(미니바+달성률%, latestDomainScores를 goals[].area와 매칭) / 우 인라인 편집.
 * "변경 저장" 시 updateTherapyPlanGoal(recordId, index, patch) → 확인된 계획서는 재확인 대기로 리셋된다.
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

const THERAPY_TYPE_LABEL: Record<string, string> = {
  speech: "언어치료",
  physical: "물리치료",
  occupational: "작업치료",
  psychological: "심리치료",
  other: "기타",
};

const AREA_META: Record<TherapyArea, { icon: string; label: string }> = {
  physical: { icon: "🖐", label: "신체 (구강운동)" },
  language: { icon: "💬", label: "언어" },
  cognitive: { icon: "🧠", label: "인지" },
  social: { icon: "🤝", label: "사회성" },
};

export function TherapyPlanDetail({ detail }: { detail: Detail }) {
  const router = useRouter();
  const goals = detail.content.goals ?? [];
  const [selected, setSelected] = useState(0);
  const scores = detail.latestDomainScores;
  const typeLabel = THERAPY_TYPE_LABEL[detail.content.therapy_type] ?? "치료";

  const current = goals[selected];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-headline-2 font-extrabold text-foreground">{typeLabel} 계획서</h1>
        <DomainChip domain="MED" label={`의료 · ${typeLabel}`} />
        {detail.isDraft && (
          <span className="rounded-(--br-sm) bg-muted px-2 py-0.5 text-caption font-semibold text-muted-foreground">
            임시저장
          </span>
        )}
        {detail.requiresConfirmation && <ConfirmBadge confirmedAt={detail.confirmedAt} />}
      </div>
      <p className="mt-1 text-body text-muted-foreground">
        {detail.content.diagnosis} · 영역별 목표 진행 상황을 점검하고 인라인 편집합니다.
      </p>

      {/* 기본정보 */}
      <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-xl bg-white p-5 ring-1 ring-foreground/10 sm:grid-cols-2">
        <InfoRow k="담당 치료사" v={detail.content.responsible_therapist} />
        <InfoRow
          k="치료 기간"
          v={`${detail.content.plan_period.start} ~ ${detail.content.plan_period.end}`}
        />
        <InfoRow k="진단" v={detail.content.diagnosis} />
        <InfoRow k="회기 빈도" v={detail.content.session_frequency} />
        <InfoRow k="진행 회기" v={`${detail.sessionCount}회기`} />
        {detail.content.precautions && (
          <InfoRow k="주의사항" v={detail.content.precautions} />
        )}
      </dl>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          className="h-11"
          render={<Link href={`/timeline?personId=${detail.personId}`} />}
        >
          🕐 타임라인 보기
        </Button>
        <Button
          variant="outline"
          className="h-11"
          render={<Link href={`/records/session/new?personId=${detail.personId}`} />}
        >
          회기 일지 작성 →
        </Button>
      </div>

      <div className="mt-6 grid gap-0 overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:grid-cols-[320px_1fr]">
        {/* 좌: 영역별 목표 + 달성도 */}
        <div
          className="border-b border-border bg-white lg:border-r lg:border-b-0"
          aria-label="치료 목표 영역 목록"
        >
          <div className="border-b border-border px-4 py-3 text-label font-bold text-accent-stone">
            🎯 영역별 목표 및 달성도
          </div>
          {goals.length === 0 ? (
            <p className="px-4 py-6 text-body text-muted-foreground">등록된 치료 목표가 없습니다.</p>
          ) : (
            <ul>
              {goals.map((g, i) => {
                const meta = AREA_META[g.area];
                const score = scores ? scores[g.area] : null;
                const on = i === selected;
                // 목표 대비 60% 미만 달성 시 저달성 경고(모바일 TherapyPlanDetailScreen과 동일 기준,
                // 웹엔 이 스타일이 없었다 — 2026-07-19 프로토타입 대조로 동기화).
                const alert = score != null && g.target_score != null && score < g.target_score * 0.6;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-current={on}
                      onClick={() => setSelected(i)}
                      className={`flex w-full flex-col gap-1 border-l-4 px-4 py-3 text-left transition-colors ${
                        on
                          ? "border-domain-med-accent bg-domain-med-bg"
                          : "border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <span className="flex items-center justify-between text-caption font-bold text-domain-med-text">
                        <span>
                          <span aria-hidden="true">{meta?.icon}</span> {meta?.label ?? g.area}
                        </span>
                        <span>{score != null ? `${score}%` : "미평가"}</span>
                      </span>
                      <span className="text-body font-semibold text-foreground">
                        {g.long_term || "(목표 미입력)"}
                      </span>
                      <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className={`block h-full rounded-full ${alert ? "bg-[#D9822B]" : "bg-domain-med-accent"}`}
                          style={{ width: `${score ?? 0}%` }}
                        />
                      </span>
                      <span className="text-caption text-muted-foreground">
                        목표 점수 {g.target_score != null ? `${g.target_score}%` : "-"} · 현재{" "}
                        {score != null ? `${score}%` : "미평가"}
                        {alert ? (
                          <span className="font-bold text-[#D9822B]"> · ⚠️ 집중 필요</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 우: 인라인 편집 */}
        <div className="min-h-[280px] bg-background p-5">
          {current ? (
            <GoalEditor
              key={selected}
              recordId={detail.recordId}
              goalIndex={selected}
              areaLabel={AREA_META[current.area]?.label ?? current.area}
              initialLongTerm={current.long_term ?? ""}
              initialShortTerm={current.short_term ?? ""}
              initialTarget={current.target_score}
              onSaved={() => router.refresh()}
            />
          ) : (
            <p className="text-body text-muted-foreground">편집할 목표를 선택하세요.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalEditor({
  recordId,
  goalIndex,
  areaLabel,
  initialLongTerm,
  initialShortTerm,
  initialTarget,
  onSaved,
}: {
  recordId: string;
  goalIndex: number;
  areaLabel: string;
  initialLongTerm: string;
  initialShortTerm: string;
  initialTarget?: number;
  onSaved: () => void;
}) {
  const [longTerm, setLongTerm] = useState(initialLongTerm);
  const [shortTerm, setShortTerm] = useState(initialShortTerm);
  const [target, setTarget] = useState(initialTarget != null ? String(initialTarget) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setDone(false);
    const patch: TherapyPlanGoalPatch = {
      long_term: longTerm.trim(),
      short_term: shortTerm.trim(),
    };
    const parsed = target.trim() === "" ? undefined : Number(target);
    if (parsed != null && Number.isFinite(parsed)) {
      patch.target_score = Math.round(parsed);
    }
    const res = await updateTherapyPlanGoal(recordId, goalIndex, patch);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-headline-3 font-bold text-foreground">{areaLabel} 목표 편집</h3>
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-semibold text-accent-stone">장기 목표</span>
        <textarea
          className={`${fieldClass} min-h-20`}
          value={longTerm}
          onChange={(e) => setLongTerm(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-semibold text-accent-stone">단기 목표</span>
        <input
          className={fieldClass}
          value={shortTerm}
          onChange={(e) => setShortTerm(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-semibold text-accent-stone">목표 점수 (0~100)</span>
        <input
          type="number"
          min={0}
          max={100}
          className={`${fieldClass} w-32`}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="미설정"
        />
      </label>

      {error && (
        <p role="alert" className="text-body font-semibold text-red-600">
          {error}
        </p>
      )}
      {done && !error && (
        <p role="status" className="text-body font-semibold text-primary-700">
          ✓ 변경이 저장되었습니다. (확인된 계획서는 재확인 대기 상태로 전환됩니다)
        </p>
      )}

      <Button
        type="button"
        className="h-11 self-start bg-domain-med-accent font-bold text-white"
        disabled={busy}
        onClick={save}
      >
        {busy ? "저장 중..." : "변경 저장"}
      </Button>
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption font-semibold text-muted-foreground">{k}</dt>
      <dd className="text-body text-foreground">{v || "-"}</dd>
    </div>
  );
}
