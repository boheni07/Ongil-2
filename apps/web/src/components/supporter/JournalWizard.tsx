"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { computeServiceHours, type SupportJournalInput } from "@ongil/validation";
import { submitSupportJournal, getPreviousJournal } from "@/app/(app)/journal/actions";
import { DateField } from "@/components/form/DateField";
import { TimeField } from "@/components/form/TimeField";
import { IconOption } from "@/components/person/IconOption";
import { Button } from "@/components/ui/button";

/**
 * S-12 활동지원 일지 작성 — 서비스정보·활동내역(+이전일지 참조)·건강식사·특이사항을 한
 * 화면에서 입력한다(2026-07-19, 기존 5단계 위저드를 병합해 대체).
 * 이전 일지 참조는 더 이상 "2단계 진입" 타이밍이 아니라 이용자가 정해지는 즉시(마운트
 * 시점 포함) 자동으로 불러온다.
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

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ExistingJournal {
  id: string;
  personId: string;
  content: SupportJournalInput;
}

/**
 * `existing`이 있으면 임시저장(draft) 일지를 이어서 작성하는 모드다(2026-07-21, "임시저장된
 * 일지를 선택하면 계속 작성할 수 있는 기능이 없다" 요청 반영) — 모든 필드를 그 content로
 * 초기화하고, 저장 시 새로 INSERT하지 않고 submitSupportJournal에 recordId를 넘겨 UPDATE한다.
 */
export function JournalWizard({
  persons,
  existing,
}: {
  persons: JournalPersonOption[];
  existing?: ExistingJournal;
}) {
  const router = useRouter();
  const ec = existing?.content;

  const [personId, setPersonId] = useState(existing?.personId ?? persons[0]?.id ?? "");
  const [serviceDate, setServiceDate] = useState(ec?.service_date ?? todayISO());
  const [startTime, setStartTime] = useState(ec?.start_time ?? "");
  const [endTime, setEndTime] = useState(ec?.end_time ?? "");
  // 계획(사전 일정) 시간 — 선택 입력. 실적(service_hours: start/end 자동 계산)과 별개(docs/07 §5 갭④).
  const [scheduledHours, setScheduledHours] = useState(
    ec?.scheduled_hours != null ? String(ec.scheduled_hours) : ""
  );
  const [minutes, setMinutes] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const a of ec?.activities ?? []) map[a.category] = a.minutes;
    return map;
  });
  const [health, setHealth] = useState<Health>(ec?.health_status ?? "good");
  const [meal, setMeal] = useState<Meal>(ec?.meal_status ?? "full");
  const [incidents, setIncidents] = useState(ec?.incidents ?? "");
  const [handover, setHandover] = useState(ec?.handover_note ?? "");
  const [referenceId, setReferenceId] = useState<string | undefined>(ec?.reference_journal_id);

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

  // 이용자가 정해지는 즉시(마운트 시점 포함) 이전 일지를 자동으로 불러온다 — 기존엔
  // "활동 내역" 단계에 도달해야만 불러왔다(2026-07-17, docs/08 §6 Wave1-5의 자동 불러오기를
  // 단일화면 전환에 맞게 더 앞당김).
  useEffect(() => {
    if (prev === null && personId) {
      loadPrevious();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  function applyPrevious() {
    if (!prev || prev === "loading") return;
    const c = prev.content;
    const map: Record<string, number> = {};
    for (const a of c.activities ?? []) map[a.category] = a.minutes;
    setMinutes(map);
    // 예전 데이터(수기 편집·과거 시드 등)에 지금 스키마 enum에 없는 값이 남아있을 수 있어,
    // 그대로 넘기면 임시저장 시에도 서버 Zod 검증에 걸려 알기 어려운 에러가 난다
    // (2026-07-21, health_status='normal' 시드 버그로 실제 재현됨) — 유효한 값일 때만 반영.
    if (HEALTHS.some((h) => h.value === c.health_status)) setHealth(c.health_status);
    if (MEALS.some((m) => m.value === c.meal_status)) setMeal(c.meal_status);
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

  const canSubmit = Boolean(
    personId && serviceDate && startTime && activities.length > 0 && previewHours != null
  );

  async function save(isDraft: boolean) {
    if (!personId) {
      setError("이용자를 선택해주세요.");
      return;
    }
    if (!isDraft && !canSubmit) {
      setError("이용자·서비스 날짜·시작시간·활동 내역·종료 시간을 모두 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submitSupportJournal(personId, buildInput(), isDraft, existing?.id);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(res.recordId ? `/journals/${res.recordId}` : "/home");
    router.refresh();
  }

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
    <div className="mx-auto flex w-full min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        {existing ? "임시저장 일지 이어서 작성" : "활동일지 작성"}
      </h1>
      <p className="mt-1 text-body text-muted-foreground">
        {personName} 님 · {serviceDate}
      </p>

      {/* 2026-07-20: 기존 max-w-2xl 단일 컬럼은 웹 넓은 화면을 못 살리는 모바일 폭 레이아웃이라
          지적받았다 — 왼쪽에 입력 섹션, 오른쪽에 이전 일지 참조·제출 전 확인·액션 버튼을 스크롤
          중에도 계속 보이는 고정(sticky) 사이드바로 재구성했다. lg 미만에서는 세로로 자연스럽게
          쌓인다(오른쪽 → 왼쪽 아래). */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
            <legend className="-mt-1 mb-1 px-1 text-label font-bold text-domain-dai-text">
              📋 서비스 정보
            </legend>
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
              <DateField className={fieldClass} value={serviceDate} onChange={setServiceDate} />
            </Field>
            <Field label="시작 시간" required>
              <TimeField value={startTime} onChange={setStartTime} aria-label="시작 시간" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="종료 시간" required>
              <TimeField value={endTime} onChange={setEndTime} aria-label="종료 시간" />
            </Field>
            <Field label="서비스 시간 (자동)">
              <input
                readOnly
                className={`${fieldClass} border-domain-dai-accent/40 bg-domain-dai-bg font-bold text-domain-dai-text`}
                value={previewHours != null ? `${previewHours}시간` : "종료 시간 입력"}
              />
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
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="-mt-1 mb-1 px-1 text-label font-bold text-domain-dai-text">
            🚶 활동 내역
          </legend>
          <p className="mb-2 text-label font-semibold text-accent-stone">활동 카테고리 (복수 선택)</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {CATEGORIES.map((c) => {
              const on = c.key in minutes;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCategory(c.key)}
                  className={`flex min-h-11 flex-col items-center gap-1 rounded-(--br-md) border-2 px-2 py-2 text-caption font-semibold transition-colors ${
                    on
                      ? "border-domain-dai-accent bg-domain-dai-bg text-domain-dai-text"
                      : "border-border text-accent-stone hover:border-domain-dai-accent/60"
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
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
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
        </fieldset>

        <fieldset className="flex flex-col gap-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="-mt-1 mb-1 px-1 text-label font-bold text-domain-dai-text">
            💪 건강·식사
          </legend>
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
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="-mt-1 mb-1 px-1 text-label font-bold text-domain-dai-text">
            📝 특이사항 <span className="font-normal text-muted-foreground">(선택)</span>
          </legend>
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
        </fieldset>
        </div>

        {/* 오른쪽 사이드바 — 스크롤해도 계속 보이도록 lg 이상에서 sticky. 이전 일지 참조·제출 전
            확인 요약·액션 버튼을 한데 모아 넓은 화면에서 "옆에 두고 참고하며 입력"할 수 있게 한다. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
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

          {/* 프로토타입 S-12 5단계 "확인·제출" 요약 카드 — 위자드를 단일 화면으로 합치면서도
              제출 전 한눈에 확인하는 감각은 남겨둔다(2026-07-19). */}
          <div className="rounded-xl border border-domain-dai-accent/30 bg-domain-dai-bg p-5">
            <h3 className="text-label font-bold text-domain-dai-text">✅ 제출 전 확인</h3>
            <dl className="mt-3 flex flex-col gap-2 text-body">
              <SummaryRow k="이용자" v={personName} />
              <SummaryRow
                k="날짜·시간"
                v={`${serviceDate} · ${startTime || "--:--"}~${endTime || "--:--"}${previewHours != null ? ` (${previewHours}시간)` : ""}`}
              />
              <SummaryRow
                k="활동"
                v={selectedCategories.length > 0 ? selectedCategories.join(" · ") : "선택된 활동 없음"}
              />
              <SummaryRow
                k="식사·건강"
                v={`${MEALS.find((m) => m.value === meal)?.label} · ${HEALTHS.find((h) => h.value === health)?.label}`}
              />
              <SummaryRow k="특이사항" v={incidents.trim() || handover.trim() ? "있음" : "없음"} last />
            </dl>
          </div>

          {error && (
            <p role="alert" className="text-body font-semibold text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
            <Button
              type="button"
              className="h-11 bg-primary-600 font-bold"
              disabled={busy || !canSubmit}
              onClick={() => save(false)}
            >
              {busy ? "제출 중..." : "제출하기"}
            </Button>
            <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={() => save(true)}>
              💾 임시저장
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => router.push("/home")}>
              취소
            </Button>
          </div>
        </div>
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
    <div
      className={`flex items-baseline justify-between gap-3 ${last ? "" : "border-b border-domain-dai-accent/20 pb-2"}`}
    >
      <dt className="shrink-0 text-caption font-semibold text-domain-dai-text/70">{k}</dt>
      <dd className="text-right font-semibold text-foreground">{v}</dd>
    </div>
  );
}
