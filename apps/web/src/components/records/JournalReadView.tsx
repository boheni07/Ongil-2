import type { SupportJournalInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 활동지원 일지(DAI-002) 읽기 전용 뷰.
 * JournalWizard.tsx와 동일한 식사·건강 상태 라벨을 사용한다.
 * content.service_hours는 스키마엔 없지만 서버(actions.ts)가 계산해 채워 넣는 실적 시간이다.
 */

const MEAL_LABEL: Record<SupportJournalInput["meal_status"], string> = {
  full: "😋 잘 먹음",
  partial: "😐 조금",
  none: "❌ 못 먹음",
};

const HEALTH_LABEL: Record<SupportJournalInput["health_status"], string> = {
  good: "💪 양호",
  sick: "🤧 감기 기운",
  tired: "😴 피곤함",
};

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="text-xl leading-none">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold tracking-wide text-domain-dai-text/70 uppercase">{label}</span>
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

export function JournalReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<SupportJournalInput> & { service_hours?: number };
  const activities = c.activities ?? [];
  const timeRange = c.start_time && c.end_time ? `${c.start_time} ~ ${c.end_time}` : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-dai-bg/70 p-4 ring-1 ring-domain-dai-accent/25">
        <SummaryStat icon="📅" label="서비스 날짜" value={c.service_date} />
        <SummaryStat icon="🕒" label="시간" value={timeRange} />
        <SummaryStat icon="⏱" label="실적 시간" value={c.service_hours != null ? `${c.service_hours}시간` : undefined} />
        {c.scheduled_hours != null && <SummaryStat icon="🗓" label="계획 시간" value={`${c.scheduled_hours}시간`} />}
      </div>

      {activities.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
          <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">활동 내역</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border text-left text-label text-accent-stone">
                  <th className="px-5 py-2.5 font-semibold">활동</th>
                  <th className="px-5 py-2.5 text-right font-semibold">시간</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-semibold text-domain-dai-text">{a.category}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">{a.minutes}분</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        <h3 className="border-b border-border bg-muted/40 px-5 py-2.5 text-sm font-bold text-foreground">건강·식사</h3>
        <dl className="divide-y divide-border">
          <InfoRow label="식사 상태" value={c.meal_status ? MEAL_LABEL[c.meal_status] : undefined} />
          <InfoRow label="건강 상태" value={c.health_status ? HEALTH_LABEL[c.health_status] : undefined} />
        </dl>
      </div>

      {c.incidents && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">특이사항 / 사고·안전</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.incidents}</p>
        </div>
      )}

      {c.handover_note && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">다음 지원사에게 인계</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.handover_note}</p>
        </div>
      )}
    </div>
  );
}
