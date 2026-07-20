import type { CaseConferenceNoteInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 사례회의록(WEL-006) 읽기 전용 뷰.
 * 일상 기록이라 구조가 단순 — 요약 바 + 참석자 칩 + 논의내용/결정사항 카드.
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

export function CaseConferenceReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<CaseConferenceNoteInput>;
  const participants = c.participants ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-domain-wel-bg/70 p-4 ring-1 ring-domain-wel-accent/25">
        <SummaryStat icon="🗓" label="회의 일시" value={c.meetingDate?.replace("T", " ")} />
        <SummaryStat icon="👥" label="참석자" value={participants.length ? `${participants.length}명` : undefined} />
      </div>

      {participants.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-3 text-sm font-bold text-foreground">참석자</h3>
          <div className="flex flex-wrap gap-2">
            {participants.map((p, i) => (
              <span
                key={i}
                className="rounded-full bg-domain-wel-bg px-3 py-1 text-caption font-semibold text-domain-wel-text"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
        <h3 className="mb-2 text-sm font-bold text-foreground">논의 내용</h3>
        <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">
          {c.discussion || <span className="text-muted-foreground">—</span>}
        </p>
      </div>

      {c.decisions && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">결정사항</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.decisions}</p>
        </div>
      )}
    </div>
  );
}
