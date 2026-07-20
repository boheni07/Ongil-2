import type { ServiceUsageInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 서비스이용계획(WEL-005) 읽기 전용 뷰.
 * TherapyPlanReadView와 동일 패턴. 상태 라벨/색상은 `ServiceUsageTable.tsx`(W-17 서비스 이용
 * 현황)와 맞춘다(active=이용중·paused=대기·ended=종료).
 */

const STATUS_META: Record<ServiceUsageInput["services"][number]["status"], { label: string; className: string }> = {
  active: { label: "이용중", className: "bg-primary-50 text-primary-700" },
  paused: { label: "대기", className: "bg-accent-amber/20 text-[#B56F10]" },
  ended: { label: "종료", className: "bg-muted text-muted-foreground" },
};

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="text-xl leading-none">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold tracking-wide text-domain-wel-text/70 uppercase">{label}</span>
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

export function ServiceUsageReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<ServiceUsageInput>;
  const services = c.services ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-wel-bg/70 p-4 ring-1 ring-domain-wel-accent/25">
        <SummaryStat icon="🗂" label="담당자" value={c.case_manager} />
        <SummaryStat icon="🗓" label="다음 검토일" value={c.next_review_date} />
        <SummaryStat icon="📋" label="서비스" value={services.length ? `${services.length}건` : undefined} />
        {c.monthly_cost != null && (
          <SummaryStat icon="💰" label="월 비용" value={`${c.monthly_cost.toLocaleString()}원`} />
        )}
      </div>

      {c.funding_source && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">기본정보</h3>
          <dl className="divide-y divide-border">
            <InfoRow label="재원 출처" value={c.funding_source} />
          </dl>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">이용 서비스</h3>
        {services.length === 0 ? (
          <p className="p-5 text-body text-muted-foreground">등록된 서비스가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">서비스</th>
                  <th className="px-3 py-2.5 font-semibold">제공기관</th>
                  <th className="px-3 py-2.5 font-semibold">빈도</th>
                  <th className="px-3 py-2.5 font-semibold">기간</th>
                  <th className="px-5 py-2.5 text-right font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => {
                  const meta = STATUS_META[s.status];
                  return (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3 align-top font-bold text-domain-wel-text">{s.service_name}</td>
                      <td className="px-3 py-3 align-top text-foreground">{s.provider || "—"}</td>
                      <td className="px-3 py-3 align-top text-foreground">{s.frequency || "—"}</td>
                      <td className="px-3 py-3 align-top text-foreground">
                        {s.start_date}
                        {s.end_date ? ` ~ ${s.end_date}` : " ~ "}
                      </td>
                      <td className="px-5 py-3 text-right align-top">
                        <span
                          className={`inline-flex items-center rounded-(--br-sm) px-2.5 py-1 text-caption font-bold ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
