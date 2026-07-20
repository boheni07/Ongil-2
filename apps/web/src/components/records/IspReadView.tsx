import type { IspInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 개인별지원계획(ISP, WEL-004) 읽기 전용 뷰.
 * 요약 바(지원기간·재사정일·담당자) → 기본정보 표 → 욕구사정 테이블 →
 * 목표 영역 테이블(달성률 pill) → 서비스 계획 테이블.
 */

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

export function IspReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<IspInput>;
  const needs = c.needs ?? [];
  const goals = c.goals ?? [];
  const services = c.services ?? [];
  const period =
    c.service_period?.start && c.service_period?.end
      ? `${c.service_period.start} ~ ${c.service_period.end}`
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-wel-bg/70 p-4 ring-1 ring-domain-wel-accent/25">
        <SummaryStat icon="📅" label="지원 기간" value={period} />
        <SummaryStat icon="🔁" label="재사정 예정일" value={c.reassessment_date} />
        <SummaryStat icon="🧑‍💼" label="담당자" value={c.case_manager} />
      </div>

      {c.assessment_tool && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">기본정보</h3>
          <dl className="divide-y divide-border">
            <InfoRow label="사정 도구" value={c.assessment_tool} />
          </dl>
        </div>
      )}

      {needs.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">욕구 사정</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">영역</th>
                  <th className="px-3 py-2.5 font-semibold">욕구 진술</th>
                  <th className="px-5 py-2.5 font-semibold">장애 요인</th>
                </tr>
              </thead>
              <tbody>
                {needs.map((n, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 align-top font-semibold text-domain-wel-text">{n.area}</td>
                    <td className="px-3 py-3 align-top text-foreground">{n.needs || "—"}</td>
                    <td className="px-5 py-3 align-top text-foreground">{n.barriers || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">목표 영역</h3>
        {goals.length === 0 ? (
          <p className="p-5 text-body text-muted-foreground">등록된 목표가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">영역</th>
                  <th className="px-3 py-2.5 font-semibold">장기 목표</th>
                  <th className="px-3 py-2.5 font-semibold">단기 목표</th>
                  <th className="px-3 py-2.5 font-semibold">담당·기한</th>
                  <th className="px-5 py-2.5 text-right font-semibold">달성률</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 align-top font-semibold text-domain-wel-text">{g.area || "—"}</td>
                    <td className="px-3 py-3 align-top text-foreground">{g.long_term || "—"}</td>
                    <td className="px-3 py-3 align-top text-foreground">{g.short_term || "—"}</td>
                    <td className="px-3 py-3 align-top text-foreground">
                      {g.responsible || "—"}
                      {g.deadline && <span className="text-caption text-muted-foreground"> · {g.deadline}</span>}
                    </td>
                    <td className="px-5 py-3 text-right align-top tabular-nums">
                      {g.achievement_rate != null ? (
                        <span className="inline-flex rounded-full bg-domain-wel-bg px-2.5 py-1 text-caption font-bold text-domain-wel-text">
                          {g.achievement_rate}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {services.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">서비스 계획</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">서비스</th>
                  <th className="px-3 py-2.5 font-semibold">제공기관</th>
                  <th className="px-3 py-2.5 font-semibold">빈도</th>
                  <th className="px-5 py-2.5 font-semibold">개시일</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 text-foreground">{s.service || "—"}</td>
                    <td className="px-3 py-3 text-foreground">{s.provider || "—"}</td>
                    <td className="px-3 py-3 text-foreground">{s.frequency || "—"}</td>
                    <td className="px-5 py-3 text-foreground">{s.start || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
