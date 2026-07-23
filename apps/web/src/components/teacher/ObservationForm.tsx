"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OBSERVATION_TAG_CATALOG, type ObservationInput } from "@ongil/validation";
import {
  createObservation,
  getIepDetail,
  type TeacherStudent,
} from "@/app/(app)/records/iep/actions";
import { Button } from "@/components/ui/button";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";

/**
 * T-16 관찰기록 작성(프로토타입 web-teacher.html 445~496줄).
 * 학생 선택 → 관찰 일시·상황 → 4개 카테고리 태그칩 복수선택 → 관찰 내용 → 연결 IEP 목표(선택).
 * 연결 목표 옵션은 선택 학생의 최근 IEP content.annual_goals에서 "영역 · 목표" 라벨로 파생한다
 * (linkedGoalArea는 FK가 아닌 느슨한 문자열 매칭 키 — actions.ts getIepDetail 매칭 기준과 일치).
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function ObservationForm({
  students,
  initialPersonId,
}: {
  students: TeacherStudent[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [personId, setPersonId] = usePersonSelection(students, initialPersonId);
  const [observedAt, setObservedAt] = useState(nowLocal());
  const [situation, setSituation] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [linkedGoalArea, setLinkedGoalArea] = useState("");
  const [goalOptions, setGoalOptions] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 선택 학생의 최근 IEP 목표 라벨을 불러와 연결 옵션을 만든다.
  useEffect(() => {
    const student = students.find((s) => s.personId === personId);
    const recordId = student?.latestIepRecordId;
    if (!recordId) {
      setGoalOptions([]);
      setLinkedGoalArea("");
      return;
    }
    let cancelled = false;
    (async () => {
      const detail = await getIepDetail(recordId);
      if (cancelled) return;
      const opts = (detail?.content.annual_goals ?? [])
        .filter((g) => g.area || g.goal)
        .map((g) => (g.goal ? `${g.area} · ${g.goal}` : g.area));
      setGoalOptions(opts);
      setLinkedGoalArea((prev) => (opts.includes(prev) ? prev : ""));
    })();
    return () => {
      cancelled = true;
    };
  }, [personId, students]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function save() {
    if (!personId) {
      setError("학생을 선택해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: ObservationInput & { personId: string } = {
      personId,
      observedAt,
      situation: situation.trim(),
      tags,
      note: note.trim(),
      ...(linkedGoalArea ? { linkedGoalArea } : {}),
    };
    const res = await createObservation(input);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(`/timeline?personId=${personId}`);
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">관찰기록 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 학생이 없어 관찰기록을 작성할 수 없습니다.
        </p>
      </div>
    );
  }

  const student = students.find((s) => s.personId === personId) ?? null;

  return (
    <div className="mx-auto flex w-full min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">관찰기록 작성</h1>
      <p className="mt-1 text-body text-muted-foreground">
        행동·언어·사회성·학습 태그를 복수 선택할 수 있습니다.
      </p>

      {/* 2026-07-20: 기록 작성화면의 와이드 레이아웃 기준을 IEP(EDU-001)로 통일 — 짧은 일상
          기록도 예외를 두지 않고 동일한 max-w-6xl + 1fr/340px 사이드바 구조를 쓴다. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex flex-col gap-6">
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
              <Field label="관찰 일시" required>
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                />
              </Field>
            </div>
            <Field label="관찰 상황" required>
              <input
                className={fieldClass}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="예: 3교시 국어 모둠 활동"
              />
            </Field>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
            <legend className="text-sm font-bold text-foreground">
              관찰 태그 <span className="text-caption font-normal text-muted-foreground">({tags.length}개 선택됨)</span>
            </legend>
            {Object.entries(OBSERVATION_TAG_CATALOG).map(([category, catTags]) => (
              <div key={category}>
                <p className="mb-1.5 text-caption font-bold text-domain-edu-text">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {catTags.map((tag) => {
                    const on = tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleTag(tag)}
                        className={`min-h-11 rounded-full border-2 px-3.5 text-caption font-semibold transition-colors ${
                          on
                            ? "border-domain-edu-accent bg-domain-edu-bg text-domain-edu-text"
                            : "border-border text-accent-stone hover:border-primary-400"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
            <legend className="text-sm font-bold text-foreground">관찰 내용</legend>
            <Field label="관찰 내용" required>
              <textarea
                className={`${fieldClass} min-h-28`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={3000}
                placeholder="관찰한 학생의 행동·반응을 구체적으로 기록하세요."
              />
            </Field>
            <Field label="연결할 IEP 목표 (선택)">
              <select
                className={fieldClass}
                value={linkedGoalArea}
                onChange={(e) => setLinkedGoalArea(e.target.value)}
                disabled={goalOptions.length === 0}
              >
                <option value="">
                  {goalOptions.length === 0 ? "연결 가능한 IEP 목표가 없습니다" : "연결 안 함"}
                </option>
                {goalOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-5">
            <h3 className="text-label font-bold text-primary-800">요약</h3>
            <dl className="mt-2 flex flex-col gap-1.5 text-caption">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">학생</dt>
                <dd className="font-semibold text-foreground">{student?.fullName ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">선택 태그</dt>
                <dd className="font-semibold text-foreground">{tags.length}개</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">확인 절차</dt>
                <dd className="text-right font-semibold text-foreground">불필요(일상 기록)</dd>
              </div>
            </dl>
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
              {busy ? "저장 중..." : "관찰기록 저장"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => router.back()}>
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
