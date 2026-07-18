"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listCaseNotes,
  type CaseNoteClient,
  type CaseNoteSummary,
} from "@/app/(app)/records/case-notes/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";

/**
 * W-22 사례회의록(WEL-006) 목록 — 사회복지사 진입 허브(LegRecordsBoard.tsx와 동일 구조).
 * 담당 당사자(getCaseNoteClients, WEL write/edit 권한자)를 선택하면 해당 당사자의 사례회의록을
 * listCaseNotes로 불러와 최신순 표시한다. 확인 절차가 없는 일상 기록이라 ConfirmBadge를 쓰지 않는다.
 */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function CaseNotesBoard({
  clients,
  initialPersonId,
}: {
  clients: CaseNoteClient[];
  initialPersonId?: string;
}) {
  const [personId, setPersonId] = useState(
    initialPersonId && clients.some((c) => c.personId === initialPersonId)
      ? initialPersonId
      : clients[0]?.personId ?? ""
  );
  const [notes, setNotes] = useState<CaseNoteSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const client = clients.find((c) => c.personId === personId) ?? null;

  useEffect(() => {
    if (!personId) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const rows = await listCaseNotes(personId);
      if (cancelled) return;
      setNotes(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  if (clients.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className="text-headline-2 font-extrabold text-foreground">사례회의록</h1>
        <p className="mt-4 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          담당 당사자가 없습니다. 보호자가 복지서비스(WEL) 도메인 작성 권한을 부여하면 해당
          당사자의 사례회의록을 작성하고 관리할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">사례회의록</h1>
          <p className="mt-1 text-body text-muted-foreground">
            ISP 수립·재사정 논의 내용과 결정사항을 기록하고 관리하세요.
          </p>
        </div>
        <Button
          render={<Link href={`/records/case-notes/new?personId=${personId}`} />}
          className="h-11 bg-domain-wel-accent px-4 font-bold text-white"
        >
          ＋ 사례회의록 작성
        </Button>
      </div>

      <label className="mt-6 flex flex-col gap-1.5">
        <span className="text-label font-semibold text-accent-stone">대상 당사자</span>
        <select
          className="min-h-11 w-full max-w-md rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.personId} value={c.personId}>
              {c.fullName}
            </option>
          ))}
        </select>
      </label>

      {client && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-t-4 border-domain-wel-accent bg-white p-4 ring-1 ring-foreground/10">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-domain-wel-bg text-body font-bold text-domain-wel-text"
          >
            {client.fullName.slice(0, 2) || "당사자"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-body font-bold text-foreground">{client.fullName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StageBadge lifeStage={client.lifeStage} interactive={false} className="min-h-6 pr-2 text-[11px]" />
              <span className="text-caption text-muted-foreground">사례회의록 {client.caseNoteCount}건</span>
            </div>
          </div>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-headline-3 font-bold text-accent-stone">기록 목록</h2>
      {loading ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          불러오는 중...
        </p>
      ) : notes.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          아직 작성된 사례회의록이 없습니다. 위 버튼으로 첫 회의록을 작성하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li
              key={n.recordId}
              className="flex flex-col gap-1.5 rounded-xl bg-white p-4 ring-1 ring-foreground/10"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-body font-semibold text-foreground">
                  {formatDate(n.meetingDate)} 회의
                </span>
                <span className="text-caption text-muted-foreground">
                  참석: {n.participants.join(", ")}
                </span>
              </div>
              <p className="text-body text-foreground">{n.discussion}</p>
              {n.decisions && (
                <p className="text-caption text-muted-foreground">
                  <span className="font-semibold text-domain-wel-text">결정사항</span> {n.decisions}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
