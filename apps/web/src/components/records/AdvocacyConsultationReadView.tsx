import type { AdvocacyConsultationInput, AdvocacyIssueType } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 권익옹호 상담기록(LEG-002) 읽기 전용 뷰.
 * AdvocacyConsultationForm.tsx와 동일한 상담 유형 라벨을 사용한다.
 */

const ISSUE_TYPE_LABEL: Record<AdvocacyIssueType, string> = {
  rights_violation: "인권침해",
  discrimination: "차별",
  abuse_suspected: "학대의심",
  other: "기타",
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

export function AdvocacyConsultationReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<AdvocacyConsultationInput>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-leg-bg/70 p-4 ring-1 ring-domain-leg-accent/25">
        <SummaryStat icon="🕒" label="상담 일시" value={c.consultedAt?.replace("T", " ")} />
        <SummaryStat icon="⚠️" label="상담 유형" value={c.issueType ? ISSUE_TYPE_LABEL[c.issueType] : undefined} />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">상담 내용</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.content || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      {c.actionTaken && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">취한 조치</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.actionTaken}</p>
        </div>
      )}

      {c.referralAgency && (
        <div className="rounded-xl bg-muted/40 p-4 text-body text-foreground ring-1 ring-foreground/10">
          🏢 연계 기관: <span className="font-semibold">{c.referralAgency}</span>
        </div>
      )}
    </div>
  );
}
