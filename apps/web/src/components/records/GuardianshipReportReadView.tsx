import type { GuardianshipReportInput, GuardianType, LegReportKind } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 후견감독보고서(LEG-001) 읽기 전용 뷰.
 * GuardianshipReportWizard.tsx와 동일한 라벨 매핑을 사용한다.
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

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="text-xl leading-none">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold tracking-wide text-domain-leg-text/70 uppercase">{label}</span>
        <span className="text-body font-bold text-foreground">
          {value || <span className="font-normal text-muted-foreground">—</span>}
        </span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-5 py-3">
      <dt className="text-label font-semibold text-accent-stone">{label}</dt>
      <dd className="whitespace-pre-wrap text-body text-foreground">
        {value || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export function GuardianshipReportReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<GuardianshipReportInput>;
  const period =
    c.report_period?.start && c.report_period?.end
      ? `${c.report_period.start} ~ ${c.report_period.end}`
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-leg-bg/70 p-4 ring-1 ring-domain-leg-accent/25">
        <SummaryStat icon="📑" label="보고 구분" value={c.report_kind ? REPORT_KIND_LABEL[c.report_kind] : undefined} />
        <SummaryStat icon="📅" label="보고 기간" value={period} />
        <SummaryStat icon="⏭" label="다음 보고 예정일" value={c.next_report_due} />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">기본정보</h3>
        <dl className="divide-y divide-border">
          <InfoRow label="후견 유형" value={c.guardian_type ? GUARDIAN_TYPE_LABEL[c.guardian_type] : undefined} />
          <InfoRow label="후견인 성명" value={c.guardian_name} />
        </dl>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">재산관리 현황</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.property_management_summary || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">신상보호 현황</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.personal_care_summary || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      {c.incidents && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">특이사항</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.incidents}</p>
        </div>
      )}
    </div>
  );
}
