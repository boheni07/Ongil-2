"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { IspGoalPatch } from "@ongil/validation";
import { updateIspGoal, type IspDetail } from "@/app/(app)/records/isp/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/form/DateField";

/**
 * W-14 ISP 점검 Split Pane(프로토타입 web-social-worker.html 331~382줄).
 * 좌: 목표 영역 리스트 + 달성률 바(+D-30 경고) / 우: 선택 목표 달성률 큰 숫자 + 인라인 편집.
 * 프로토타입의 세부목표 리스트·세그먼트바는 스키마에 없는 전용 디테일이라 단순화하여
 * long_term/short_term/responsible/deadline/achievement_rate 편집 폼으로 대체한다(과잉 구현 금지).
 * "변경 저장" 시 updateIspGoal(recordId, index, patch) → 확인된 ISP는 재확인 대기로 리셋된다.
 * 재사정 D-30 경고 배지는 detail.reassessmentDday(0~30)에서 노출한다.
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

/** 재사정 D-day 배지 — 0~30이면 경고, 음수면 기한 초과. 그 외/누락이면 렌더 없음. */
function ReassessmentBadge({ dday }: { dday: number | null }) {
  if (dday == null || dday > 30) return null;
  const text = dday < 0 ? `재사정 기한 초과 (${Math.abs(dday)}일 지남)` : `재사정 D-${dday}`;
  return (
    <span className="inline-flex items-center rounded-(--br-sm) bg-domain-med-bg px-2.5 py-1 text-caption font-bold text-domain-med-text">
      ⚠ {text}
    </span>
  );
}

export function IspReviewPane({ detail }: { detail: IspDetail }) {
  const router = useRouter();
  const goals = detail.content.goals ?? [];
  const [selected, setSelected] = useState(0);

  const current = goals[selected];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-headline-2 font-extrabold text-foreground">ISP 점검 · 달성률</h1>
        <DomainChip domain="WEL" />
        {detail.requiresConfirmation && <ConfirmBadge confirmedAt={detail.confirmedAt} />}
        <ReassessmentBadge dday={detail.reassessmentDday} />
      </div>
      <p className="mt-1 text-body text-muted-foreground">
        담당 {detail.content.case_manager} · 지원 {detail.content.service_period?.start} ~{" "}
        {detail.content.service_period?.end} · 재사정 예정 {detail.content.reassessment_date} · 영역별
        목표 진행 상황을 점검하고 인라인 편집합니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          render={<Link href={`/records/service-status?personId=${detail.personId}`} />}
          className="h-10 w-fit px-4 font-semibold"
        >
          📋 이 당사자의 서비스 이용 현황(WEL-005) 보기
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/records/case-notes?personId=${detail.personId}`} />}
          className="h-10 w-fit px-4 font-semibold"
        >
          📝 이 당사자의 사례회의록(WEL-006) 보기
        </Button>
      </div>

      <div className="mt-6 grid gap-0 overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:grid-cols-[300px_1fr]">
        {/* 좌: 목표 영역 리스트 */}
        <div
          className="border-b border-border bg-white lg:border-r lg:border-b-0"
          aria-label="ISP 목표 영역 목록"
        >
          <div className="border-b border-border px-4 py-3 text-label font-bold text-accent-stone">
            📋 목표 영역
          </div>
          {goals.length === 0 ? (
            <p className="px-4 py-6 text-body text-muted-foreground">등록된 목표가 없습니다.</p>
          ) : (
            <ul>
              {goals.map((g, i) => {
                const rate = typeof g.achievement_rate === "number" ? g.achievement_rate : null;
                const on = i === selected;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      aria-current={on}
                      onClick={() => setSelected(i)}
                      className={`flex w-full flex-col gap-1 border-l-4 px-4 py-3 text-left transition-colors ${
                        on
                          ? "border-domain-wel-accent bg-domain-wel-bg"
                          : "border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <span className="text-caption font-bold text-domain-wel-text">
                        {g.area || `목표 ${i + 1}`}
                      </span>
                      <span className="text-body font-semibold text-foreground">
                        {g.long_term || "(목표 미입력)"}
                      </span>
                      <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-domain-wel-accent"
                          style={{ width: `${rate ?? 0}%` }}
                        />
                      </span>
                      <span className="text-caption text-muted-foreground">
                        달성률 {rate != null ? `${rate}%` : "미평가"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 우: 선택 목표 달성률 + 인라인 편집 */}
        <div className="min-h-[320px] bg-background p-5">
          {current ? (
            <GoalEditor
              key={selected}
              recordId={detail.recordId}
              goalIndex={selected}
              initialArea={current.area ?? ""}
              initialLongTerm={current.long_term ?? ""}
              initialShortTerm={current.short_term ?? ""}
              initialResponsible={current.responsible ?? ""}
              initialDeadline={current.deadline ?? ""}
              initialRate={current.achievement_rate}
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
  initialArea,
  initialLongTerm,
  initialShortTerm,
  initialResponsible,
  initialDeadline,
  initialRate,
  onSaved,
}: {
  recordId: string;
  goalIndex: number;
  initialArea: string;
  initialLongTerm: string;
  initialShortTerm: string;
  initialResponsible: string;
  initialDeadline: string;
  initialRate?: number;
  onSaved: () => void;
}) {
  const [area, setArea] = useState(initialArea);
  const [longTerm, setLongTerm] = useState(initialLongTerm);
  const [shortTerm, setShortTerm] = useState(initialShortTerm);
  const [responsible, setResponsible] = useState(initialResponsible);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [rate, setRate] = useState(initialRate != null ? String(initialRate) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const displayRate = rate.trim() === "" ? null : Number(rate);

  async function save() {
    setBusy(true);
    setError(null);
    setDone(false);
    const patch: IspGoalPatch = {
      area: area.trim(),
      long_term: longTerm.trim(),
      short_term: shortTerm.trim(),
      responsible: responsible.trim(),
      deadline: deadline.trim(),
    };
    const parsedRate = rate.trim() === "" ? undefined : Number(rate);
    if (parsedRate != null && Number.isFinite(parsedRate)) {
      patch.achievement_rate = Math.round(parsedRate);
    }
    const res = await updateIspGoal(recordId, goalIndex, patch);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-white p-4 ring-1 ring-domain-wel-accent/40">
        <div className="text-3xl font-extrabold text-domain-wel-text">
          {displayRate != null && Number.isFinite(displayRate) ? `${Math.round(displayRate)}%` : "미평가"}
        </div>
        <div className="mt-1 text-caption text-muted-foreground">
          {area || "목표"} · 목표 달성률
        </div>
        <span className="mt-3 block h-2 w-full overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-domain-wel-accent"
            style={{
              width: `${
                displayRate != null && Number.isFinite(displayRate)
                  ? Math.max(0, Math.min(100, Math.round(displayRate)))
                  : 0
              }%`,
            }}
          />
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-accent-stone">영역</span>
          <input className={fieldClass} value={area} onChange={(e) => setArea(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-accent-stone">달성률 (0~100)</span>
          <input
            type="number"
            min={0}
            max={100}
            className={fieldClass}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="미평가"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-semibold text-accent-stone">장기 목표</span>
        <input
          className={fieldClass}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-accent-stone">담당</span>
          <input
            className={fieldClass}
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-accent-stone">목표 기한</span>
          <DateField className={fieldClass} value={deadline} onChange={setDeadline} />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-body font-semibold text-red-600">
          {error}
        </p>
      )}
      {done && !error && (
        <p role="status" className="text-body font-semibold text-primary-700">
          ✓ 변경이 저장되었습니다. (확인된 ISP는 재확인 대기 상태로 전환됩니다)
        </p>
      )}

      <Button
        type="button"
        className="h-11 self-start bg-domain-wel-accent font-bold text-domain-wel-text"
        disabled={busy}
        onClick={save}
      >
        {busy ? "저장 중..." : "변경 저장"}
      </Button>
    </div>
  );
}
