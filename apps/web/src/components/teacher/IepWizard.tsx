"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { IepInput } from "@ongil/validation";
import { createIep, type TeacherStudent } from "@/app/(app)/records/iep/actions";
import { DateField } from "@/components/form/DateField";
import { ChoiceGroup } from "@/components/form/ChoiceGroup";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { isPreTransitionStage, isSelfConfirmingStage } from "@/lib/lifecycle";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";

/**
 * T-13 IEP 작성 — 기본정보·현재수준·목표평가·지원서비스·전환계획을 한 화면에서 입력한다
 * (2026-07-19, 기존 6단계 위저드를 병합해 대체). 전환계획 섹션은 선택 학생의 lifeStage가
 * 영유아기·아동기(만12세 이하)가 아닐 때만 활성화된다.
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

interface ShortTermGoalDraft {
  goal: string;
  period: string;
  evaluation: string;
}
interface AnnualGoalDraft {
  area: string;
  goal: string;
  shortTerm: ShortTermGoalDraft[];
}
interface SupportServiceDraft {
  service: string;
  provider: string;
  frequency: string;
}

const LEVEL_FIELDS: { key: keyof IepInput["current_levels"]; label: string }[] = [
  { key: "korean", label: "국어" },
  { key: "math", label: "수학" },
  { key: "social", label: "사회성" },
  { key: "communication", label: "의사소통" },
  { key: "self_care", label: "자조기술" },
];

function emptyAnnualGoal(): AnnualGoalDraft {
  return { area: "", goal: "", shortTerm: [{ goal: "", period: "", evaluation: "" }] };
}

export function IepWizard({
  students,
  initialPersonId,
}: {
  students: TeacherStudent[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [personId, setPersonId] = usePersonSelection(students, initialPersonId);

  const [school, setSchool] = useState("");
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [meetingDate, setMeetingDate] = useState("");
  const [participants, setParticipants] = useState("");
  const [levels, setLevels] = useState<Record<string, string>>({
    korean: "",
    math: "",
    social: "",
    communication: "",
    self_care: "",
  });
  const [annualGoals, setAnnualGoals] = useState<AnnualGoalDraft[]>([emptyAnnualGoal()]);
  const [services, setServices] = useState<SupportServiceDraft[]>([
    { service: "", provider: "", frequency: "" },
  ]);
  const [transitionGoalArea, setTransitionGoalArea] = useState<
    "" | "career" | "independent_living" | "community" | "further_education"
  >("");
  const [transitionGoal, setTransitionGoal] = useState("");
  const [transitionSteps, setTransitionSteps] = useState("");
  const [transitionAgencies, setTransitionAgencies] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const student = useMemo(
    () => students.find((s) => s.personId === personId) ?? null,
    [students, personId]
  );
  const showTransition = student ? !isPreTransitionStage(student.lifeStage) : false;

  function updateGoal(i: number, patch: Partial<AnnualGoalDraft>) {
    setAnnualGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function updateShortTerm(gi: number, si: number, patch: Partial<ShortTermGoalDraft>) {
    setAnnualGoals((prev) =>
      prev.map((g, idx) =>
        idx === gi
          ? { ...g, shortTerm: g.shortTerm.map((st, j) => (j === si ? { ...st, ...patch } : st)) }
          : g
      )
    );
  }

  function buildInput(): IepInput & { personId: string } {
    const trimmedGoals = annualGoals
      .map((g) => ({
        area: g.area.trim(),
        goal: g.goal.trim(),
        short_term_goals: g.shortTerm
          .filter((st) => st.goal.trim() || st.period.trim() || st.evaluation.trim())
          .map((st) => ({
            goal: st.goal.trim(),
            period: st.period.trim(),
            evaluation: st.evaluation.trim(),
          })),
      }))
      .filter((g) => g.area || g.goal || g.short_term_goals.length > 0);

    const trimmedServices = services
      .filter((s) => s.service.trim() || s.provider.trim() || s.frequency.trim())
      .map((s) => ({
        service: s.service.trim(),
        provider: s.provider.trim(),
        frequency: s.frequency.trim(),
      }));

    const base: IepInput & { personId: string } = {
      personId,
      school: school.trim(),
      academic_year: academicYear.trim(),
      meeting_date: meetingDate,
      participants: participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      current_levels: {
        korean: levels.korean,
        math: levels.math,
        social: levels.social,
        communication: levels.communication,
        self_care: levels.self_care,
      },
      annual_goals: trimmedGoals,
      support_services: trimmedServices,
    };

    if (showTransition) {
      base.transition_plan = {
        ...(transitionGoalArea ? { goal_area: transitionGoalArea } : {}),
        goal: transitionGoal.trim(),
        steps: transitionSteps
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        ...(transitionAgencies.trim() ? { linked_agencies: transitionAgencies.trim() } : {}),
      };
    }
    return base;
  }

  const canSubmit = Boolean(
    personId &&
      school.trim() &&
      academicYear.trim() &&
      meetingDate &&
      annualGoals.some((g) => g.area.trim() || g.goal.trim())
  );

  async function submit() {
    if (!canSubmit) {
      setError("학생·학교명·학년도·IEP 회의 날짜와 연간 목표를 하나 이상 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createIep(buildInput());
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(res.recordId ? `/records/iep/${res.recordId}/review` : "/home");
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">개별화교육계획 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 학생이 없어 IEP를 작성할 수 없습니다. 보호자가 교육(EDU) 도메인 작성 권한을 부여하면
          해당 학생의 IEP를 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">개별화교육계획 작성</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {student ? `${student.fullName} 학생 · ${academicYear}학년도` : "학생을 선택하세요"}
        {student && <StageBadge lifeStage={student.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">기본 정보</legend>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="학교명" required>
              <input
                className={fieldClass}
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="예: 온길특수학교"
              />
            </Field>
            <Field label="학년도" required>
              <input
                className={fieldClass}
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="예: 2026"
              />
            </Field>
          </div>
          <Field label="IEP 회의 날짜" required>
            <DateField className={fieldClass} value={meetingDate} onChange={setMeetingDate} />
          </Field>
          <Field label="참석자 (쉼표로 구분)">
            <input
              className={fieldClass}
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="특수교사, 학부모, 통합학급 담임, 치료지원 담당"
            />
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">현재 수준</legend>
          <p className="text-body text-muted-foreground">5개 영역의 현재 수행 수준을 기술합니다.</p>
          {LEVEL_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <textarea
                className={`${fieldClass} min-h-20`}
                value={levels[f.key]}
                onChange={(e) => setLevels((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder="현재 수행 수준을 구체적으로 기술하세요"
              />
            </Field>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">목표·평가</legend>
          <p className="text-body text-muted-foreground">
            연간 목표별로 영역·목표와 단기 목표(기간·평가 방법)를 설정합니다.
          </p>
          {annualGoals.map((g, gi) => (
            <div
              key={gi}
              className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-label font-bold text-domain-edu-text">
                  연간 목표 {gi + 1}
                </span>
                {annualGoals.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setAnnualGoals((prev) => prev.filter((_, idx) => idx !== gi))
                    }
                  >
                    삭제
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <Field label="영역">
                  <input
                    className={fieldClass}
                    value={g.area}
                    onChange={(e) => updateGoal(gi, { area: e.target.value })}
                    placeholder="국어"
                  />
                </Field>
                <Field label="연간 목표">
                  <input
                    className={fieldClass}
                    value={g.goal}
                    onChange={(e) => updateGoal(gi, { goal: e.target.value })}
                    placeholder="받침 있는 낱말을 정확히 읽고 쓸 수 있다"
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-label font-semibold text-accent-stone">단기 목표</span>
                {g.shortTerm.map((st, si) => (
                  <div key={si} className="grid gap-2 sm:grid-cols-[1fr_120px_140px_auto]">
                    <input
                      className={fieldClass}
                      value={st.goal}
                      onChange={(e) => updateShortTerm(gi, si, { goal: e.target.value })}
                      placeholder="단기 목표"
                      aria-label={`연간 목표 ${gi + 1} 단기 목표 ${si + 1}`}
                    />
                    <input
                      className={fieldClass}
                      value={st.period}
                      onChange={(e) => updateShortTerm(gi, si, { period: e.target.value })}
                      placeholder="1분기"
                      aria-label={`연간 목표 ${gi + 1} 단기 목표 ${si + 1} 기간`}
                    />
                    <input
                      className={fieldClass}
                      value={st.evaluation}
                      onChange={(e) => updateShortTerm(gi, si, { evaluation: e.target.value })}
                      placeholder="관찰 평가"
                      aria-label={`연간 목표 ${gi + 1} 단기 목표 ${si + 1} 평가 방법`}
                    />
                    {g.shortTerm.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11"
                        onClick={() =>
                          updateGoal(gi, {
                            shortTerm: g.shortTerm.filter((_, idx) => idx !== si),
                          })
                        }
                        aria-label={`단기 목표 ${si + 1} 삭제`}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    updateGoal(gi, {
                      shortTerm: [...g.shortTerm, { goal: "", period: "", evaluation: "" }],
                    })
                  }
                >
                  ＋ 단기 목표 추가
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setAnnualGoals((prev) => [...prev, emptyAnnualGoal()])}
          >
            ＋ 연간 목표 추가
          </Button>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">지원 서비스 (선택)</legend>
          <p className="text-body text-muted-foreground">
            필요한 관련 서비스와 지원 인력·빈도를 입력합니다.
          </p>
          {services.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]">
              <input
                className={fieldClass}
                value={s.service}
                onChange={(e) =>
                  setServices((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, service: e.target.value } : x))
                  )
                }
                placeholder="서비스 (예: 언어치료)"
                aria-label={`지원 서비스 ${i + 1}`}
              />
              <input
                className={fieldClass}
                value={s.provider}
                onChange={(e) =>
                  setServices((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, provider: e.target.value } : x))
                  )
                }
                placeholder="제공자 (예: 언어치료사)"
                aria-label={`지원 서비스 ${i + 1} 제공자`}
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
                aria-label={`지원 서비스 ${i + 1} 빈도`}
              />
              {services.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11"
                  onClick={() => setServices((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`지원 서비스 ${i + 1} 삭제`}
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
              setServices((prev) => [...prev, { service: "", provider: "", frequency: "" }])
            }
          >
            ＋ 지원 서비스 추가
          </Button>
        </fieldset>

        {showTransition && (
          <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
            <legend className="text-sm font-bold text-foreground">전환 계획 (선택)</legend>
            <div className="rounded-(--br-md) bg-domain-tra-bg p-3 text-caption font-semibold text-domain-tra-text">
              🔀 전환계획은 만 13세 이상 학생에게 표시됩니다.
            </div>
            <Field label="전환 목표 영역">
              <ChoiceGroup
                ariaLabel="전환 목표 영역"
                value={transitionGoalArea}
                onChange={setTransitionGoalArea}
                columns={2}
                options={[
                  { value: "", label: "선택 안 함" },
                  { value: "career", label: "진로·직업" },
                  { value: "independent_living", label: "자립생활" },
                  { value: "community", label: "지역사회 참여" },
                  { value: "further_education", label: "계속교육" },
                ]}
              />
            </Field>
            <Field label="희망 진로">
              <input
                className={fieldClass}
                value={transitionGoal}
                onChange={(e) => setTransitionGoal(e.target.value)}
                placeholder="바리스타 직업훈련 희망 (학생·보호자 면담 기반)"
              />
            </Field>
            <Field label="전환 활동 계획 (줄바꿈으로 단계 구분)">
              <textarea
                className={`${fieldClass} min-h-28`}
                value={transitionSteps}
                onChange={(e) => setTransitionSteps(e.target.value)}
                placeholder={"직업체험(카페 실습)\n자립생활 훈련(대중교통 이용)"}
              />
            </Field>
            <Field label="연계 기관">
              <input
                className={fieldClass}
                value={transitionAgencies}
                onChange={(e) => setTransitionAgencies(e.target.value)}
                placeholder="발달장애인 훈련센터, 지역 장애인복지관"
              />
            </Field>
          </fieldset>
        )}

      </div>

      {/* 오른쪽 사이드바(lg:sticky) — 확인 요청 대상 안내·요약·액션 버튼을 스크롤 중에도
          계속 접근 가능하게 둔다(2026-07-20, JournalWizard와 동일한 와이드 레이아웃 원칙). */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="rounded-xl bg-domain-edu-bg p-5 text-body text-domain-edu-text ring-1 ring-domain-edu-accent/30">
          ✅ IEP는 공식 문서로 저장 시 확인(Confirmation) 절차가 시작됩니다. 저장 후 학생 타임라인과
          IEP 점검 화면에 기록됩니다.
          <span className="mt-2 block font-bold">
            📋 확인 요청 대상: {student && isSelfConfirmingStage(student.lifeStage) ? "본인" : "보호자"}
          </span>
        </div>

        <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-5">
          <h3 className="text-label font-bold text-primary-800">요약</h3>
          <dl className="mt-2 flex flex-col gap-1.5 text-caption">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">학생</dt>
              <dd className="font-semibold text-foreground">{student?.fullName ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">학교 · 학년도</dt>
              <dd className="text-right font-semibold text-foreground">
                {school || "-"} · {academicYear || "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">연간 목표</dt>
              <dd className="font-semibold text-foreground">
                {annualGoals.filter((g) => g.area.trim() || g.goal.trim()).length}개
              </dd>
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
            className="h-11 bg-primary-600 font-bold"
            disabled={busy || !canSubmit}
            onClick={submit}
          >
            {busy ? "저장 중..." : "IEP 저장"}
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
