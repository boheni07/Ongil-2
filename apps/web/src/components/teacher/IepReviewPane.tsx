"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { IepGoalPatch } from "@ongil/validation";
import { updateIepGoal, type IepDetail } from "@/app/(app)/records/iep/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { Button } from "@/components/ui/button";

/**
 * T-14 IEP 점검 Split Pane(프로토타입 web-teacher.html 399~442줄).
 * 좌: 영역별 연간 목표 리스트 + 달성률 바 / 우: 선택 목표 인라인 편집 + 참조 패널.
 * 참조 패널 탭: 이전 버전 비교(previousVersion.current_levels), 관찰기록 연결(linkedObservations).
 * "변경 저장" 시 updateIepGoal(recordId, index, patch) 호출 → 확인된 IEP는 재확인 대기로 리셋된다.
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

type RefTab = "diff" | "obs";

export function IepReviewPane({ detail }: { detail: IepDetail }) {
  const router = useRouter();
  const goals = detail.content.annual_goals ?? [];
  const [selected, setSelected] = useState(0);
  const [refTab, setRefTab] = useState<RefTab>("diff");

  const current = goals[selected];

  // 인라인 편집 대상 필드 — 선택 목표 변경 시 폼을 다시 채우기 위해 key로 재마운트한다.
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-headline-2 font-extrabold text-foreground">IEP 점검</h1>
        <DomainChip domain="EDU" />
        {detail.requiresConfirmation && (
          <ConfirmBadge confirmedAt={detail.confirmedAt} />
        )}
      </div>
      <p className="mt-1 text-body text-muted-foreground">
        {detail.content.academic_year}학년도 · {detail.content.school} · 영역별 목표 진행 상황을
        점검하고 인라인 편집합니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          render={<Link href={`/records/observation/new?personId=${detail.personId}`} />}
          className="h-10 w-fit px-4 font-semibold"
        >
          📝 이 학생의 관찰기록 작성
        </Button>
        <Button
          variant="outline"
          render={<Link href={`/timeline?personId=${detail.personId}`} />}
          className="h-10 w-fit px-4 font-semibold"
        >
          🕐 타임라인 보기
        </Button>
      </div>

      <div className="mt-6 grid gap-0 overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:grid-cols-[300px_1fr]">
        {/* 좌: 목표 영역 리스트 */}
        <div className="border-b border-border bg-white lg:border-r lg:border-b-0" aria-label="IEP 목표 영역 목록">
          <div className="border-b border-border px-4 py-3 text-label font-bold text-accent-stone">
            📋 IEP 목표 영역
          </div>
          {goals.length === 0 ? (
            <p className="px-4 py-6 text-body text-muted-foreground">등록된 연간 목표가 없습니다.</p>
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
                          ? "border-domain-edu-accent bg-domain-edu-bg"
                          : "border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <span className="text-caption font-bold text-domain-edu-text">
                        {g.area || `목표 ${i + 1}`}
                      </span>
                      <span className="text-body font-semibold text-foreground">
                        {g.goal || "(목표 미입력)"}
                      </span>
                      <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-domain-edu-accent"
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

        {/* 우: 선택 목표 인라인 편집 + 참조 패널 */}
        <div className="min-h-[320px] bg-background p-5">
          {current ? (
            <GoalEditor
              key={selected}
              recordId={detail.recordId}
              goalIndex={selected}
              initialArea={current.area ?? ""}
              initialGoal={current.goal ?? ""}
              initialRate={current.achievement_rate}
              initialNote={current.evaluation_note ?? ""}
              onSaved={() => router.refresh()}
            />
          ) : (
            <p className="text-body text-muted-foreground">편집할 목표를 선택하세요.</p>
          )}

          <div className="mt-6 rounded-xl border border-border bg-white">
            <div className="flex gap-1 border-b border-border p-1" role="tablist" aria-label="참조 패널">
              <TabButton active={refTab === "diff"} onClick={() => setRefTab("diff")}>
                📑 이전 버전 비교
              </TabButton>
              <TabButton active={refTab === "obs"} onClick={() => setRefTab("obs")}>
                🔗 관찰기록 연결
              </TabButton>
            </div>
            <div className="p-4">
              {refTab === "diff" ? (
                <DiffPanel detail={detail} />
              ) : (
                <ObsPanel detail={detail} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalEditor({
  recordId,
  goalIndex,
  initialArea,
  initialGoal,
  initialRate,
  initialNote,
  onSaved,
}: {
  recordId: string;
  goalIndex: number;
  initialArea: string;
  initialGoal: string;
  initialRate?: number;
  initialNote: string;
  onSaved: () => void;
}) {
  const [area, setArea] = useState(initialArea);
  const [goal, setGoal] = useState(initialGoal);
  const [rate, setRate] = useState(initialRate != null ? String(initialRate) : "");
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setDone(false);
    const patch: IepGoalPatch = {
      area: area.trim(),
      goal: goal.trim(),
      evaluation_note: note.trim(),
    };
    const parsedRate = rate.trim() === "" ? undefined : Number(rate);
    if (parsedRate != null && Number.isFinite(parsedRate)) {
      patch.achievement_rate = Math.round(parsedRate);
    }
    const res = await updateIepGoal(recordId, goalIndex, patch);
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
      <h3 className="text-headline-3 font-bold text-foreground">
        {area || "목표"} · {goal || "인라인 편집"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-accent-stone">영역</span>
          <input className={fieldClass} value={area} onChange={(e) => setArea(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-accent-stone">연간 목표</span>
          <input className={fieldClass} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-semibold text-accent-stone">달성률 (0~100)</span>
        <input
          type="number"
          min={0}
          max={100}
          className={`${fieldClass} w-32`}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="미평가"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-label font-semibold text-accent-stone">평가 메모</span>
        <textarea
          className={`${fieldClass} min-h-24`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
        />
      </label>

      {error && (
        <p role="alert" className="text-body font-semibold text-red-600">
          {error}
        </p>
      )}
      {done && !error && (
        <p role="status" className="text-body font-semibold text-primary-700">
          ✓ 변경이 저장되었습니다. (확인된 IEP는 재확인 대기 상태로 전환됩니다)
        </p>
      )}

      <Button
        type="button"
        className="h-11 self-start bg-domain-edu-accent font-bold text-domain-edu-text"
        disabled={busy}
        onClick={save}
      >
        {busy ? "저장 중..." : "변경 저장"}
      </Button>
    </div>
  );
}

function DiffPanel({ detail }: { detail: IepDetail }) {
  const prev = detail.previousVersion;
  if (!prev) {
    return <p className="text-body text-muted-foreground">이전 버전이 없습니다.</p>;
  }
  const cur = detail.content.current_levels;
  const old = prev.content.current_levels;
  const rows: { label: string; key: keyof typeof cur }[] = [
    { label: "국어", key: "korean" },
    { label: "수학", key: "math" },
    { label: "사회성", key: "social" },
    { label: "의사소통", key: "communication" },
    { label: "자조기술", key: "self_care" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-muted-foreground">
        {prev.academicYear}학년도(이전) ↔ {detail.content.academic_year}학년도(현재) 현재 수준 비교
      </p>
      {rows.map((r) => (
        <div key={r.key} className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-(--br-md) bg-muted/50 p-2.5">
            <div className="text-caption font-bold text-muted-foreground">
              {r.label} · {prev.academicYear}
            </div>
            <div className="mt-0.5 text-body text-foreground">{old?.[r.key] || "-"}</div>
          </div>
          <div className="rounded-(--br-md) bg-domain-edu-bg p-2.5">
            <div className="text-caption font-bold text-domain-edu-text">
              {r.label} · {detail.content.academic_year}
            </div>
            <div className="mt-0.5 text-body text-foreground">{cur?.[r.key] || "-"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ObsPanel({ detail }: { detail: IepDetail }) {
  return (
    <div className="flex flex-col gap-2">
      {detail.linkedObservations.length === 0 ? (
        <p className="text-body text-muted-foreground">연결된 관찰기록이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {detail.linkedObservations.map((o) => (
            <li key={o.recordId} className="flex gap-2 rounded-(--br-md) bg-muted/50 p-2.5">
              <span aria-hidden="true">👀</span>
              <div className="min-w-0">
                <p className="text-body text-foreground">{o.situation || "관찰기록"}</p>
                <p className="text-caption text-muted-foreground">
                  {o.observedAt ? o.observedAt.slice(0, 16).replace("T", " ") : ""}
                  {o.tags.length > 0 ? ` · ${o.tags.join(", ")}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        className="mt-1 w-full"
        render={<Link href={`/records/observation/new?personId=${detail.personId}`} />}
      >
        ＋ 새 관찰기록 연결
      </Button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-(--br-md) px-3 text-label font-semibold transition-colors ${
        active ? "bg-domain-edu-bg text-domain-edu-text" : "text-muted-foreground hover:bg-muted/60"
      }`}
    >
      {children}
    </button>
  );
}
