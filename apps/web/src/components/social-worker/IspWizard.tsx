"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { IspInput } from "@ongil/validation";
import { createIsp, type SocialWorkerClient } from "@/app/(app)/records/isp/actions";
import { WizardProgress } from "@/components/form/WizardProgress";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";

/**
 * W-13 ISP 작성 5단계 위저드(프로토타입 web-social-worker.html 282~328줄).
 * 기본정보 → 욕구사정 → 목표영역 → 서비스계획 → 확인·제출.
 * 프로토타입엔 욕구사정(2단계)만 상세하나, 나머지 단계는 WEL-004 스키마
 * (service_period, reassessment_date, case_manager, needs[], goals[], services[])에 맞춰 구성한다.
 * 중간 단계는 클라이언트 상태만 유지하고 마지막 확인에서 createIsp(snake_case content)를 호출한다.
 */

const STEP_LABELS = ["기본 정보", "욕구 사정", "목표 영역", "서비스 계획", "확인·저장"];

const NEED_AREAS = [
  "자립생활 지원",
  "사회참여 확대",
  "직업훈련·고용",
  "건강관리",
  "여가·문화활동",
  "가족지원",
];

const ASSESSMENT_TOOLS = [
  "ICF 기반 기능평가",
  "지역사회적응검사(CIS-A)",
  "일상생활수행능력(ADL) 평가",
];

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

interface GoalDraft {
  area: string;
  long_term: string;
  short_term: string;
  responsible: string;
  deadline: string;
}
interface ServiceDraft {
  service: string;
  provider: string;
  frequency: string;
  start: string;
}

function emptyGoal(): GoalDraft {
  return { area: "", long_term: "", short_term: "", responsible: "", deadline: "" };
}

export function IspWizard({
  clients,
  initialPersonId,
}: {
  clients: SocialWorkerClient[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [personId, setPersonId] = useState(
    initialPersonId && clients.some((c) => c.personId === initialPersonId)
      ? initialPersonId
      : clients[0]?.personId ?? ""
  );

  const [caseManager, setCaseManager] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [reassessmentDate, setReassessmentDate] = useState("");

  const [needAreas, setNeedAreas] = useState<string[]>([]);
  const [needStatement, setNeedStatement] = useState("");
  const [assessmentTool, setAssessmentTool] = useState(ASSESSMENT_TOOLS[0]);

  const [goals, setGoals] = useState<GoalDraft[]>([emptyGoal()]);
  const [services, setServices] = useState<ServiceDraft[]>([
    { service: "", provider: "", frequency: "", start: "" },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );

  function toggleNeedArea(area: string) {
    setNeedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }
  function updateGoal(i: number, patch: Partial<GoalDraft>) {
    setGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }

  function buildInput(): IspInput & { personId: string } {
    const trimmedGoals = goals
      .map((g) => ({
        area: g.area.trim(),
        long_term: g.long_term.trim(),
        short_term: g.short_term.trim(),
        responsible: g.responsible.trim(),
        deadline: g.deadline.trim(),
      }))
      .filter((g) => g.area || g.long_term || g.short_term);

    const trimmedServices = services
      .filter((s) => s.service.trim() || s.provider.trim() || s.frequency.trim())
      .map((s) => ({
        service: s.service.trim(),
        provider: s.provider.trim(),
        frequency: s.frequency.trim(),
        start: s.start.trim(),
      }));

    // 욕구사정: 선택 칩 하나당 needs[] 한 항목. 욕구 진술은 칩 간 공유, barriers는 입력이 없어 빈 문자열.
    const needs = needAreas.map((area) => ({
      area,
      needs: needStatement.trim(),
      barriers: "",
    }));

    return {
      personId,
      service_period: { start: periodStart, end: periodEnd },
      reassessment_date: reassessmentDate,
      case_manager: caseManager.trim(),
      assessment_tool: assessmentTool,
      needs,
      goals: trimmedGoals,
      services: trimmedServices,
    };
  }

  async function submit() {
    if (!personId) {
      setError("당사자를 선택해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createIsp(buildInput());
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(res.recordId ? `/records/isp/${res.recordId}/review` : "/home");
    router.refresh();
  }

  function nextStep() {
    setError(null);
    setStep((s) => Math.min(5, s + 1));
  }
  function prevStep() {
    setError(null);
    if (step === 1) {
      router.push("/home");
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  }

  const canNext =
    (step === 1 &&
      Boolean(personId && caseManager.trim() && periodStart && periodEnd && reassessmentDate)) ||
    step === 2 ||
    (step === 3 && goals.some((g) => g.area.trim() || g.long_term.trim())) ||
    step === 4;

  if (clients.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">개인별지원계획 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 당사자가 없어 ISP를 작성할 수 없습니다. 보호자가 복지(WEL) 도메인 작성 권한을
          부여하면 해당 당사자의 ISP를 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        개인별지원계획 작성{" "}
        <span className="text-body font-medium text-muted-foreground">ISP</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {client ? `${client.fullName} 당사자` : "당사자를 선택하세요"}
        {client && <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <WizardProgress current={step} total={5} label={STEP_LABELS[step - 1]} className="mt-5 mb-6" />

      {step === 1 && (
        <div className="flex flex-col gap-4">
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
          <Field label="담당자(사례관리자)" required>
            <input
              className={fieldClass}
              value={caseManager}
              onChange={(e) => setCaseManager(e.target.value)}
              placeholder="예: 최복지 사회복지사"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="지원 시작일" required>
              <input
                type="date"
                className={fieldClass}
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </Field>
            <Field label="지원 종료일" required>
              <input
                type="date"
                className={fieldClass}
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </Field>
          </div>
          <Field label="재사정 예정일" required>
            <input
              type="date"
              className={fieldClass}
              value={reassessmentDate}
              onChange={(e) => setReassessmentDate(e.target.value)}
            />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Field label="주요 욕구 영역 (복수 선택)">
            <div className="flex flex-wrap gap-2">
              {NEED_AREAS.map((area) => {
                const on = needAreas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleNeedArea(area)}
                    className={`min-h-11 rounded-(--br-md) border px-3.5 text-body font-semibold transition-colors ${
                      on
                        ? "border-domain-wel-accent bg-domain-wel-bg text-domain-wel-text"
                        : "border-border bg-white text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="당사자·가족 욕구 진술">
            <textarea
              className={`${fieldClass} min-h-28`}
              value={needStatement}
              onChange={(e) => setNeedStatement(e.target.value)}
              placeholder="당사자와 가족이 표현한 욕구를 기록하세요"
            />
          </Field>
          <Field label="사정 도구 / 근거">
            <select
              className={fieldClass}
              value={assessmentTool}
              onChange={(e) => setAssessmentTool(e.target.value)}
            >
              {ASSESSMENT_TOOLS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">
            목표 영역별로 장기·단기 목표와 담당·기한을 설정합니다. 달성률은 작성 이후 점검(W-14)에서
            기록합니다.
          </p>
          {goals.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-label font-bold text-domain-wel-text">목표 영역 {gi + 1}</span>
                {goals.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setGoals((prev) => prev.filter((_, idx) => idx !== gi))}
                  >
                    삭제
                  </Button>
                )}
              </div>
              <Field label="영역">
                <input
                  className={fieldClass}
                  value={g.area}
                  onChange={(e) => updateGoal(gi, { area: e.target.value })}
                  placeholder="예: 자립생활"
                />
              </Field>
              <Field label="장기 목표">
                <input
                  className={fieldClass}
                  value={g.long_term}
                  onChange={(e) => updateGoal(gi, { long_term: e.target.value })}
                  placeholder="독립적인 일상생활 수행 능력 확보"
                />
              </Field>
              <Field label="단기 목표">
                <input
                  className={fieldClass}
                  value={g.short_term}
                  onChange={(e) => updateGoal(gi, { short_term: e.target.value })}
                  placeholder="대중교통 단독 이용 훈련"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="담당">
                  <input
                    className={fieldClass}
                    value={g.responsible}
                    onChange={(e) => updateGoal(gi, { responsible: e.target.value })}
                    placeholder="예: 자립생활센터"
                  />
                </Field>
                <Field label="목표 기한">
                  <input
                    type="date"
                    className={fieldClass}
                    value={g.deadline}
                    onChange={(e) => updateGoal(gi, { deadline: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setGoals((prev) => [...prev, emptyGoal()])}
          >
            ＋ 목표 영역 추가
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">
            제공할 복지 서비스와 제공기관·빈도·개시일을 입력합니다. (선택)
          </p>
          {services.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_110px_150px_auto]">
              <input
                className={fieldClass}
                value={s.service}
                onChange={(e) =>
                  setServices((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, service: e.target.value } : x))
                  )
                }
                placeholder="서비스 (예: 주간활동)"
                aria-label={`서비스 ${i + 1}`}
              />
              <input
                className={fieldClass}
                value={s.provider}
                onChange={(e) =>
                  setServices((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, provider: e.target.value } : x))
                  )
                }
                placeholder="제공기관 (예: OO복지관)"
                aria-label={`서비스 ${i + 1} 제공기관`}
              />
              <input
                className={fieldClass}
                value={s.frequency}
                onChange={(e) =>
                  setServices((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, frequency: e.target.value } : x))
                  )
                }
                placeholder="주 2회"
                aria-label={`서비스 ${i + 1} 빈도`}
              />
              <input
                type="date"
                className={fieldClass}
                value={s.start}
                onChange={(e) =>
                  setServices((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, start: e.target.value } : x))
                  )
                }
                aria-label={`서비스 ${i + 1} 개시일`}
              />
              {services.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11"
                  onClick={() => setServices((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`서비스 ${i + 1} 삭제`}
                >
                  ✕
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() =>
              setServices((prev) => [...prev, { service: "", provider: "", frequency: "", start: "" }])
            }
          >
            ＋ 서비스 추가
          </Button>
        </div>
      )}

      {step === 5 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-domain-wel-bg p-4 ring-1 ring-domain-wel-accent/40">
            <SummaryRow k="당사자" v={client?.fullName ?? "-"} />
            <SummaryRow k="담당자" v={caseManager || "-"} />
            <SummaryRow k="지원 기간" v={`${periodStart || "-"} ~ ${periodEnd || "-"}`} />
            <SummaryRow k="재사정 예정일" v={reassessmentDate || "-"} />
            <SummaryRow k="욕구 영역" v={needAreas.length ? `${needAreas.length}개` : "미선택"} />
            <SummaryRow
              k="목표 영역"
              v={`${goals.filter((g) => g.area.trim() || g.long_term.trim()).length}개`}
            />
            <SummaryRow k="서비스 계획" v={`${services.filter((s) => s.service.trim()).length}개`} last />
          </div>
          <div className="rounded-(--br-md) bg-primary-50 p-4 text-body text-primary-700">
            ✅ ISP는 공식 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다. 저장 후 당사자
            타임라인과 ISP 점검 화면에 기록됩니다.
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-8">
        <Button type="button" variant="outline" className="h-11" onClick={prevStep}>
          ← {step === 1 ? "취소" : "이전"}
        </Button>
        <div className="flex-1" />
        {step < 5 ? (
          <Button type="button" className="h-11" disabled={!canNext} onClick={nextStep}>
            다음 →
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 bg-primary-600 font-bold"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "저장 중..." : "ISP 저장"}
          </Button>
        )}
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

function SummaryRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 py-2 text-body ${
        last ? "" : "border-b border-domain-wel-accent/25"
      }`}
    >
      <span className="shrink-0 font-semibold text-domain-wel-text">{k}</span>
      <span className="text-right text-foreground">{v}</span>
    </div>
  );
}
