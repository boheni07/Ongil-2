"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { IspInput } from "@ongil/validation";
import { createIsp, type SocialWorkerClient } from "@/app/(app)/records/isp/actions";
import { DateField } from "@/components/form/DateField";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { isSelfConfirmingStage } from "@/lib/lifecycle";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";

/**
 * W-13 ISP 작성 — 기본정보·욕구사정·목표영역·서비스계획을 한 화면에서 입력한다
 * (2026-07-19, 기존 5단계 위저드를 병합해 대체). WEL-004 스키마(service_period,
 * reassessment_date, case_manager, needs[], goals[], services[])는 그대로 유지한다.
 * 제출 시 createIsp(snake_case content)를 호출한다.
 */

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
  const [personId, setPersonId] = usePersonSelection(clients, initialPersonId);

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

  const canSubmit = Boolean(
    personId &&
      caseManager.trim() &&
      periodStart &&
      periodEnd &&
      reassessmentDate &&
      goals.some((g) => g.area.trim() || g.long_term.trim())
  );

  async function submit() {
    if (!canSubmit) {
      setError("당사자·담당자·지원 기간·재사정 예정일과 목표 영역을 하나 이상 입력해주세요.");
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
    <div className="mx-auto flex min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        개인별지원계획 작성{" "}
        <span className="text-body font-medium text-muted-foreground">ISP</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {client ? `${client.fullName} 당사자` : "당사자를 선택하세요"}
        {client && <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">기본 정보</legend>
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
              <DateField className={fieldClass} value={periodStart} onChange={setPeriodStart} max={periodEnd || undefined} />
            </Field>
            <Field label="지원 종료일" required>
              <DateField className={fieldClass} value={periodEnd} onChange={setPeriodEnd} min={periodStart || undefined} />
            </Field>
          </div>
          <Field label="재사정 예정일" required>
            <DateField className={fieldClass} value={reassessmentDate} onChange={setReassessmentDate} />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">욕구 사정</legend>
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
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">목표 영역</legend>
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
                  <DateField
                    className={fieldClass}
                    value={g.deadline}
                    onChange={(v) => updateGoal(gi, { deadline: v })}
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
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">서비스 계획 (선택)</legend>
          <p className="text-body text-muted-foreground">
            제공할 복지 서비스와 제공기관·빈도·개시일을 입력합니다.
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
              <DateField
                className={fieldClass}
                value={s.start}
                onChange={(v) =>
                  setServices((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, start: v } : x))
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
        </fieldset>

      </div>

      {/* 오른쪽 사이드바(lg:sticky) — 확인 요청 대상 안내·액션 버튼을 스크롤 중에도 계속
          접근 가능하게 둔다(2026-07-20, JournalWizard와 동일한 원칙). */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="rounded-xl bg-domain-wel-bg p-4 text-body text-domain-wel-text ring-1 ring-domain-wel-accent/30">
          ✅ ISP는 공식 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다. 저장 후 당사자
          타임라인과 ISP 점검 화면에 기록됩니다.
          <span className="mt-2 block font-bold">
            📋 확인 요청 대상: {client && isSelfConfirmingStage(client.lifeStage) ? "본인" : "보호자"}
          </span>
        </div>

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
            disabled={busy || !canSubmit}
            onClick={submit}
          >
            {busy ? "저장 중..." : "ISP 저장"}
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
