"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { computeServiceHours, type SupportJournalInput } from "@ongil/validation";
import { submitSupportJournal, getPreviousJournal } from "@/app/(app)/journal/actions";
import { WizardProgress } from "@/components/form/WizardProgress";
import { IconOption } from "@/components/person/IconOption";
import { Button } from "@/components/ui/button";

/**
 * S-12 활동지원 일지 5단계 위저드.
 * 서비스정보 → 활동내역(+이전일지 참조) → 건강·식사 → 특이사항(건너뛰기) → 확인·제출.
 * 중간 단계는 클라이언트 상태만 유지하고, 제출/임시저장에서만 submitSupportJournal을 호출한다.
 */

export interface JournalPersonOption {
  id: string;
  name: string;
}

type Health = SupportJournalInput["health_status"];
type Meal = SupportJournalInput["meal_status"];

const CATEGORIES: { key: string; emoji: string }[] = [
  { key: "신변처리", emoji: "🚿" },
  { key: "이동지원", emoji: "🚶" },
  { key: "식사보조", emoji: "🍚" },
  { key: "가사지원", emoji: "🧹" },
  { key: "병원동행", emoji: "🏥" },
  { key: "의사소통", emoji: "💬" },
];
const MEALS: { value: Meal; emoji: string; label: string }[] = [
  { value: "full", emoji: "😋", label: "잘 먹음" },
  { value: "partial", emoji: "😐", label: "조금" },
  { value: "none", emoji: "❌", label: "못 먹음" },
];
const HEALTHS: { value: Health; emoji: string; label: string }[] = [
  { value: "good", emoji: "💪", label: "양호" },
  { value: "sick", emoji: "🤧", label: "감기 기운" },
  { value: "tired", emoji: "😴", label: "피곤함" },
];
const STEP_LABELS = ["서비스 정보", "활동 내역", "건강·식사", "특이사항", "확인·제출"];

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JournalWizard({ persons }: { persons: JournalPersonOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [personId, setPersonId] = useState(persons[0]?.id ?? "");
  const [serviceDate, setServiceDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // 계획(사전 일정) 시간 — 선택 입력. 실적(service_hours: start/end 자동 계산)과 별개(docs/07 §5 갭④).
  const [scheduledHours, setScheduledHours] = useState("");
  const [minutes, setMinutes] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<Health>("good");
  const [meal, setMeal] = useState<Meal>("full");
  const [incidents, setIncidents] = useState("");
  const [handover, setHandover] = useState("");
  const [referenceId, setReferenceId] = useState<string | undefined>(undefined);

  const [prev, setPrev] = useState<
    { id: string; content: SupportJournalInput; recordDate: string } | null | undefined | "loading"
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedCategories = Object.keys(minutes).filter((k) => minutes[k] > 0 || minutes[k] === 0);
  const activities = Object.entries(minutes)
    .filter(([, m]) => m >= 0)
    .map(([category, m]) => ({ category, minutes: m }));

  const previewHours =
    startTime && endTime && endTime > startTime ? computeServiceHours(startTime, endTime) : null;

  function toggleCategory(key: string) {
    setMinutes((prevM) => {
      const next = { ...prevM };
      if (key in next) delete next[key];
      else next[key] = 0;
      return next;
    });
  }

  async function loadPrevious() {
    if (!personId) return;
    setPrev("loading");
    const res = await getPreviousJournal(personId);
    setPrev(res ?? undefined);
  }

  // 2단계(활동 내역) 진입 시 이전 일지를 자동으로 불러온다 — 최근 사용 카테고리를 클릭 한 번 없이
  // 바로 보여줘 매번 다시 고르는 번거로움을 줄인다(2026-07-17, docs/08 §6 Wave1-5).
  useEffect(() => {
    if (step === 2 && prev === null && personId) {
      loadPrevious();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, personId]);

  function applyPrevious() {
    if (!prev || prev === "loading") return;
    const c = prev.content;
    const map: Record<string, number> = {};
    for (const a of c.activities ?? []) map[a.category] = a.minutes;
    setMinutes(map);
    setHealth(c.health_status);
    setMeal(c.meal_status);
    setReferenceId(prev.id);
  }

  function buildInput(): SupportJournalInput {
    const scheduled = Number(scheduledHours);
    const hasScheduled = scheduledHours.trim() !== "" && !Number.isNaN(scheduled);
    return {
      service_date: serviceDate,
      start_time: startTime,
      end_time: endTime,
      activities,
      health_status: health,
      meal_status: meal,
      ...(hasScheduled ? { scheduled_hours: scheduled } : {}),
      ...(incidents.trim() ? { incidents: incidents.trim() } : {}),
      ...(handover.trim() ? { handover_note: handover.trim() } : {}),
      ...(referenceId ? { reference_journal_id: referenceId } : {}),
    };
  }

  async function save(isDraft: boolean) {
    if (!personId) {
      setError("이용자를 선택해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submitSupportJournal(personId, buildInput(), isDraft);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(res.recordId ? `/journals/${res.recordId}` : "/home");
    router.refresh();
  }

  const canNext =
    (step === 1 && personId && serviceDate && startTime) ||
    (step === 2 && activities.length > 0) ||
    step === 3 ||
    step === 4;

  const personName = persons.find((p) => p.id === personId)?.name ?? "이용자";

  if (persons.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">활동일지 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          아직 담당 이용자가 없어 일지를 작성할 수 없습니다. 보호자가 활동지원(일상) 도메인 작성 권한을
          부여하면 해당 이용자의 일지를 남길 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">활동일지 작성</h1>
      <p className="mt-1 text-body text-muted-foreground">
        {personName} 님 · {serviceDate}
      </p>

      <WizardProgress current={step} total={5} label={STEP_LABELS[step - 1]} className="mt-5 mb-6" />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Field label="이용자" required>
            <select className={fieldClass} value={personId} onChange={(e) => setPersonId(e.target.value)}>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="서비스 날짜" required>
              <input type="date" className={fieldClass} value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
            </Field>
            <Field label="시작 시간" required>
              <input type="time" className={fieldClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
          </div>
          <Field label="계획 시간 (선택)">
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              inputMode="decimal"
              className={fieldClass}
              value={scheduledHours}
              onChange={(e) => setScheduledHours(e.target.value)}
              placeholder="사전 일정표상 계획된 지원 시간(시간 단위). 실적은 종료 시간으로 자동 계산됩니다."
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div>
            <p className="mb-2 text-label font-semibold text-accent-stone">활동 카테고리 (복수 선택)</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const on = c.key in minutes;
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCategory(c.key)}
                    className={`flex min-h-11 flex-col items-center gap-1 rounded-(--br-md) border-2 px-2 py-2 text-caption font-semibold transition-colors ${
                      on ? "border-primary-600 bg-primary-50 text-primary-800" : "border-border text-accent-stone hover:border-primary-400"
                    }`}
                  >
                    <span aria-hidden="true" className="text-xl">
                      {c.emoji}
                    </span>
                    {c.key}
                  </button>
                );
              })}
            </div>

            {selectedCategories.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-label font-semibold text-accent-stone">활동별 소요 시간(분)</p>
                {selectedCategories.map((key) => (
                  <label key={key} className="flex items-center justify-between gap-3">
                    <span className="text-body text-foreground">{key}</span>
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      value={minutes[key]}
                      onChange={(e) => setMinutes((m) => ({ ...m, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="h-10 w-24 rounded-(--br-md) border border-border px-3 text-right text-body outline-none focus-visible:border-primary-600"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-xl bg-primary-50/60 p-4 ring-1 ring-primary-100">
            <h3 className="text-label font-bold text-primary-800">📎 이전 일지 참조</h3>
            {prev === null && (
              <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={loadPrevious}>
                이전 일지 불러오기
              </Button>
            )}
            {prev === "loading" && <p className="mt-3 text-caption text-muted-foreground">불러오는 중...</p>}
            {prev && prev !== "loading" && (
              <div className="mt-3">
                <p className="text-caption text-muted-foreground">{prev.recordDate.slice(0, 10)}</p>
                <p className="mt-1 text-body text-foreground">
                  {(prev.content.activities ?? []).map((a) => a.category).join(" · ") || "활동 기록 없음"}
                </p>
                <Button type="button" size="sm" className="mt-2 w-full" onClick={applyPrevious}>
                  이 항목 불러오기
                </Button>
              </div>
            )}
            {prev === undefined && <p className="mt-3 text-caption text-muted-foreground">참조할 이전 일지가 없습니다.</p>}
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-3 text-label font-semibold text-accent-stone">🍚 식사 상태</p>
            <div className="flex flex-wrap gap-3">
              {MEALS.map((o) => (
                <IconOption key={o.value} size="compact" emoji={o.emoji} label={o.label} selected={meal === o.value} onSelect={() => setMeal(o.value)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-label font-semibold text-accent-stone">💪 건강 상태</p>
            <div className="flex flex-wrap gap-3">
              {HEALTHS.map((o) => (
                <IconOption key={o.value} size="compact" emoji={o.emoji} label={o.label} selected={health === o.value} onSelect={() => setHealth(o.value)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-(--br-md) bg-primary-50/60 p-3 text-caption text-primary-800">
            ℹ️ 이 단계는 선택입니다. 인계할 내용이 없다면 “건너뛰기”로 확인 단계로 이동하세요.
          </div>
          <Field label="특이사항 / 사고·안전">
            <textarea
              className={`${fieldClass} min-h-24 py-2`}
              value={incidents}
              onChange={(e) => setIncidents(e.target.value)}
              maxLength={2000}
              placeholder="특이 행동, 정서 변화, 사고·위험 상황 등 (없으면 비워두세요)"
            />
          </Field>
          <Field label="다음 지원사에게 인계">
            <textarea
              className={`${fieldClass} min-h-24 py-2`}
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
              maxLength={2000}
              placeholder="다음 방문 시 참고할 내용"
            />
          </Field>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="종료 시간" required>
              <input type="time" className={fieldClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
            <Field label="서비스 시간 (자동)">
              <input
                readOnly
                className={`${fieldClass} bg-muted font-bold`}
                value={previewHours != null ? `${previewHours}시간` : "종료 시간 입력"}
              />
            </Field>
          </div>
          <div className="rounded-xl bg-domain-dai-bg p-4 ring-1 ring-domain-dai-accent/40">
            <SummaryRow k="이용자" v={personName} />
            <SummaryRow k="날짜 · 시간" v={`${serviceDate} · ${startTime || "--"}~${endTime || "--"}`} />
            <SummaryRow k="활동" v={activities.map((a) => `${a.category}${a.minutes ? ` ${a.minutes}분` : ""}`).join(" · ") || "없음"} />
            <SummaryRow k="식사 / 건강" v={`${MEALS.find((m) => m.value === meal)?.label} / ${HEALTHS.find((h) => h.value === health)?.label}`} />
            <SummaryRow k="특이사항" v={incidents.trim() || "없음"} last />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => (step === 1 ? router.push("/home") : setStep((s) => s - 1))}
          className="h-11"
        >
          ← {step === 1 ? "취소" : "이전"}
        </Button>
        <div className="flex-1" />
        {step === 5 && (
          <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={() => save(true)}>
            💾 임시저장
          </Button>
        )}
        {step === 4 && (
          <Button type="button" variant="ghost" className="h-11" onClick={() => setStep(5)}>
            건너뛰기
          </Button>
        )}
        {step < 5 ? (
          <Button type="button" className="h-11" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            다음 →
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 bg-primary-600 font-bold"
            disabled={busy || previewHours == null}
            onClick={() => save(false)}
          >
            {busy ? "제출 중..." : "제출하기"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
    <div className={`flex justify-between gap-4 py-2 text-body ${last ? "" : "border-b border-domain-dai-accent/25"}`}>
      <span className="shrink-0 font-semibold text-domain-dai-text">{k}</span>
      <span className="text-right text-foreground">{v}</span>
    </div>
  );
}
