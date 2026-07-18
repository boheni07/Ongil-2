"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuardianType, GuardianshipReportInput, LegReportKind } from "@ongil/validation";
import {
  createGuardianshipReport,
  type LegClient,
} from "@/app/(app)/records/leg/actions";
import { WizardProgress } from "@/components/form/WizardProgress";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { isSelfConfirmingStage } from "@/lib/lifecycle";

/**
 * W-18 후견감독보고서(LEG-001) 작성 4단계 위저드 — IspWizard.tsx / TransitionPlanWizard.tsx와 동일 구조.
 * 대상·후견 유형 → 재산관리/신상보호 현황 → 특이사항·다음 보고 예정일 → 확인·저장.
 * LEG-001은 법정·공식 서류라 requires_confirmation=true(§4-6) — 마지막 단계에서 "확인 요청 대상"을
 * isSelfConfirmingStage(성인기·노년기=본인, 그 외=보호자)로 안내한다(IspWizard와 동일 패턴).
 * confirmer_id/confirmed_at은 서버 트리거 소관이라 폼에서 다루지 않는다.
 */

const STEP_LABELS = ["대상·후견 유형", "관리 현황", "특이사항·기한", "확인·저장"];

const GUARDIAN_TYPE_LABEL: Record<GuardianType, string> = {
  adult: "성년후견",
  limited: "한정후견",
  specific: "특정후견",
  voluntary: "임의후견",
};

const REPORT_KIND_LABEL: Record<LegReportKind, string> = {
  initial: "최초 보고 (후견개시 재산목록)",
  periodic: "정기 보고",
};

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

export function GuardianshipReportWizard({
  clients,
  initialPersonId,
}: {
  clients: LegClient[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [personId, setPersonId] = useState(
    initialPersonId && clients.some((c) => c.personId === initialPersonId)
      ? initialPersonId
      : clients[0]?.personId ?? ""
  );

  const [reportKind, setReportKind] = useState<LegReportKind>("periodic");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [guardianType, setGuardianType] = useState<GuardianType>("adult");
  const [guardianName, setGuardianName] = useState("");
  const [propertySummary, setPropertySummary] = useState("");
  const [personalCareSummary, setPersonalCareSummary] = useState("");
  const [incidents, setIncidents] = useState("");
  const [nextReportDue, setNextReportDue] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );
  const blocked = client ? !isSelfConfirmingStage(client.lifeStage) : false;

  function buildInput(): GuardianshipReportInput {
    return {
      report_kind: reportKind,
      report_period: { start: periodStart, end: periodEnd },
      guardian_type: guardianType,
      guardian_name: guardianName.trim(),
      property_management_summary: propertySummary.trim(),
      personal_care_summary: personalCareSummary.trim(),
      incidents: incidents.trim() || undefined,
      next_report_due: nextReportDue,
    };
  }

  async function submit() {
    if (!personId) {
      setError("당사자를 선택해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createGuardianshipReport(personId, buildInput());
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(`/records/leg?personId=${personId}`);
    router.refresh();
  }

  function nextStep() {
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  }
  function prevStep() {
    setError(null);
    if (step === 1) {
      router.push("/records/leg");
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  }

  const canNext =
    (step === 1 &&
      Boolean(personId && !blocked && periodStart && periodEnd && guardianName.trim())) ||
    (step === 2 && Boolean(propertySummary.trim() && personalCareSummary.trim())) ||
    (step === 3 && Boolean(nextReportDue));

  if (clients.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">후견감독보고서 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 당사자가 없어 후견감독보고서를 작성할 수 없습니다. 보호자가 법률·권리(LEG) 도메인
          작성 권한을 부여하면 해당 당사자의 후견감독보고서를 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        후견감독보고서 작성{" "}
        <span className="text-body font-medium text-muted-foreground">LEG-001</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {client ? `${client.fullName} 당사자` : "당사자를 선택하세요"}
        {client && <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <WizardProgress current={step} total={4} label={STEP_LABELS[step - 1]} className="mt-5 mb-6" />

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

          <Field label="보고 구분" required>
            <select
              className={fieldClass}
              value={reportKind}
              onChange={(e) => setReportKind(e.target.value as LegReportKind)}
            >
              {(["periodic", "initial"] as const).map((k) => (
                <option key={k} value={k}>
                  {REPORT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>

          {blocked ? (
            <div className="rounded-(--br-md) bg-domain-med-bg p-4 text-body font-semibold text-domain-med-text">
              🔏 후견감독보고서는 성인기(만 19세) 이상부터 작성할 수 있습니다. 이 당사자는 아직 성인기
              이전 단계라 대상이 아닙니다.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="보고 시작일" required>
                  <input
                    type="date"
                    className={fieldClass}
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </Field>
                <Field label="보고 종료일" required>
                  <input
                    type="date"
                    className={fieldClass}
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="후견 유형" required>
                <select
                  className={fieldClass}
                  value={guardianType}
                  onChange={(e) => setGuardianType(e.target.value as GuardianType)}
                >
                  {(["adult", "limited", "specific", "voluntary"] as const).map((t) => (
                    <option key={t} value={t}>
                      {GUARDIAN_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="후견인 성명" required>
                <input
                  className={fieldClass}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="예: 김후견"
                />
              </Field>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">
            보고 기간 동안의 재산관리·신상보호 수행 현황을 기록합니다. 법원 제출용 서술이므로
            구체적으로 작성하세요.
          </p>
          <Field label="재산관리 현황" required>
            <textarea
              className={`${fieldClass} min-h-32`}
              value={propertySummary}
              onChange={(e) => setPropertySummary(e.target.value)}
              maxLength={3000}
              placeholder="예금·부동산 등 재산 관리 내역, 지출·수입 관리 방식 등을 기록하세요."
            />
          </Field>
          <Field label="신상보호 현황" required>
            <textarea
              className={`${fieldClass} min-h-32`}
              value={personalCareSummary}
              onChange={(e) => setPersonalCareSummary(e.target.value)}
              maxLength={3000}
              placeholder="주거·의료·복지서비스 이용 등 신상보호 관련 조치 현황을 기록하세요."
            />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Field label="특이사항 (선택)">
            <textarea
              className={`${fieldClass} min-h-28`}
              value={incidents}
              onChange={(e) => setIncidents(e.target.value)}
              maxLength={2000}
              placeholder="보고 기간 중 발생한 특이사항·분쟁·변경사항 등을 기록하세요."
            />
          </Field>
          <Field label="다음 보고 예정일" required>
            <input
              type="date"
              className={fieldClass}
              value={nextReportDue}
              onChange={(e) => setNextReportDue(e.target.value)}
            />
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-domain-leg-bg p-4 ring-1 ring-domain-leg-accent/40">
            <SummaryRow k="당사자" v={client?.fullName ?? "-"} />
            <SummaryRow k="보고 구분" v={REPORT_KIND_LABEL[reportKind]} />
            <SummaryRow k="후견 유형" v={GUARDIAN_TYPE_LABEL[guardianType]} />
            <SummaryRow k="후견인" v={guardianName || "-"} />
            <SummaryRow k="보고 기간" v={`${periodStart || "-"} ~ ${periodEnd || "-"}`} />
            <SummaryRow k="특이사항" v={incidents.trim() ? "있음" : "없음"} />
            <SummaryRow k="다음 보고 예정일" v={nextReportDue || "-"} last />
          </div>
          <div className="rounded-(--br-md) bg-primary-50 p-4 text-body text-primary-700">
            ✅ 후견감독보고서는 공식 서류로 저장 시 확인(Confirmation) 절차가 시작됩니다. 저장 후
            당사자 타임라인과 법률·권리 기록에 반영됩니다.
            <span className="mt-2 block font-bold">
              📋 확인 요청 대상: {client && isSelfConfirmingStage(client.lifeStage) ? "본인" : "보호자"}
            </span>
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
        {step < 4 ? (
          <Button type="button" className="h-11" disabled={!canNext} onClick={nextStep}>
            다음 →
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 bg-primary-600 font-bold"
            disabled={busy || blocked}
            onClick={submit}
          >
            {busy ? "저장 중..." : "후견감독보고서 저장"}
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
        last ? "" : "border-b border-domain-leg-accent/25"
      }`}
    >
      <span className="shrink-0 font-semibold text-domain-leg-text">{k}</span>
      <span className="text-right text-foreground">{v}</span>
    </div>
  );
}
