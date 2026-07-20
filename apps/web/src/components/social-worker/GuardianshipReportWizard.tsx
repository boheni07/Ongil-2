"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuardianType, GuardianshipReportInput, LegReportKind } from "@ongil/validation";
import {
  createGuardianshipReport,
  type LegClient,
} from "@/app/(app)/records/leg/actions";
import { DateField } from "@/components/form/DateField";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { isSelfConfirmingStage } from "@/lib/lifecycle";
import { usePersonSelection } from "@/hooks/useRecentPerson";
import { TargetPersonBanner } from "@/components/records/TargetPersonBanner";

/**
 * W-18 후견감독보고서(LEG-001) 작성 — 대상·후견유형·관리현황·특이사항·기한을 한 화면에서
 * 입력한다(2026-07-19, 기존 4단계 위저드를 병합해 대체).
 * LEG-001은 법정·공식 서류라 requires_confirmation=true(§4-6) — "확인 요청 대상"을
 * isSelfConfirmingStage(성인기·노년기=본인, 그 외=보호자)로 안내한다.
 * confirmer_id/confirmed_at은 서버 트리거 소관이라 폼에서 다루지 않는다.
 */

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
  const [personId, setPersonId] = usePersonSelection(clients, initialPersonId);

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

  const canSubmit = Boolean(
    personId &&
      !blocked &&
      periodStart &&
      periodEnd &&
      guardianName.trim() &&
      propertySummary.trim() &&
      personalCareSummary.trim() &&
      nextReportDue
  );

  async function submit() {
    if (!canSubmit) {
      setError("당사자·보고 기간·후견인·재산관리·신상보호·다음 보고 예정일을 모두 입력해주세요.");
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
    <div className="mx-auto flex min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        후견감독보고서 작성{" "}
        <span className="text-body font-medium text-muted-foreground">LEG-001</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        {client ? `${client.fullName} 당사자` : "당사자를 선택하세요"}
        {client && <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="text-sm font-bold text-foreground">대상·후견 유형</legend>
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
                  <DateField className={fieldClass} value={periodStart} onChange={setPeriodStart} max={periodEnd || undefined} />
                </Field>
                <Field label="보고 종료일" required>
                  <DateField className={fieldClass} value={periodEnd} onChange={setPeriodEnd} min={periodStart || undefined} />
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
        </fieldset>

        {!blocked && (
          <>
            <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
              <legend className="text-sm font-bold text-foreground">관리 현황</legend>
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
            </fieldset>

            <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
              <legend className="text-sm font-bold text-foreground">특이사항·기한</legend>
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
                <DateField className={fieldClass} value={nextReportDue} onChange={setNextReportDue} />
              </Field>
            </fieldset>

          </>
        )}
      </div>

      {/* 오른쪽 사이드바(lg:sticky) — 확인 요청 대상 안내·액션 버튼을 스크롤 중에도 계속
          접근 가능하게 둔다(2026-07-20, JournalWizard와 동일 원칙). */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        {!blocked && (
          <div className="rounded-xl bg-domain-leg-bg p-4 text-body text-domain-leg-text ring-1 ring-domain-leg-accent/30">
            ✅ 후견감독보고서는 공식 서류로 저장 시 확인(Confirmation) 절차가 시작됩니다. 저장 후
            당사자 타임라인과 법률·권리 기록에 반영됩니다.
            <span className="mt-2 block font-bold">
              📋 확인 요청 대상: {client && isSelfConfirmingStage(client.lifeStage) ? "본인" : "보호자"}
            </span>
          </div>
        )}

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
            disabled={busy || blocked || !canSubmit}
            onClick={submit}
          >
            {busy ? "저장 중..." : "후견감독보고서 저장"}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => router.push("/records/leg")}>
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
