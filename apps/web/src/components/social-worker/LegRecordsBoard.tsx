"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listLegRecords,
  type LegClient,
  type LegRecordSummary,
} from "@/app/(app)/records/leg/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { Button } from "@/components/ui/button";
import { usePersonSelection } from "@/hooks/useRecentPerson";

/**
 * W-21 법률·권리(LEG) 기록 목록 — 사회복지사 진입 허브.
 * 담당 당사자(getLegClients, LEG write/edit 권한자)를 선택하면 해당 당사자의 LEG 기록
 * (LEG-001 후견감독보고서 + LEG-002 권익옹호 상담기록)을 listLegRecords로 불러와 최신순 표시한다.
 * 상단 CTA로 두 작성 화면(W-18/W-19)에 선택 당사자를 미리 지정해 진입한다.
 * 과잉 구현 금지: 상세 조회(getLegRecordDetail)는 이번 범위 밖 — 목록 요약까지만 렌더한다.
 */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function LegRecordsBoard({
  clients,
  initialPersonId,
}: {
  clients: LegClient[];
  initialPersonId?: string;
}) {
  const [personId, setPersonId] = usePersonSelection(clients, initialPersonId);
  const [records, setRecords] = useState<LegRecordSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const client = clients.find((c) => c.personId === personId) ?? null;

  useEffect(() => {
    if (!personId) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const rows = await listLegRecords(personId);
      if (cancelled) return;
      setRecords(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  if (clients.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className="text-headline-2 font-extrabold text-foreground">법률·권리 기록</h1>
        <p className="mt-4 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          담당 당사자가 없습니다. 보호자가 법률·권리(LEG) 도메인 작성 권한을 부여하면 해당 당사자의
          후견감독보고서·권익옹호 상담기록을 작성하고 관리할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-2 font-extrabold text-foreground">법률·권리 기록</h1>
          <p className="mt-1 text-body text-muted-foreground">
            후견감독보고서·권익옹호 상담기록을 작성하고 확인 현황을 관리하세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            render={<Link href={`/records/leg/advocacy/new?personId=${personId}`} />}
            className="h-11 px-4 font-bold"
          >
            🗣 상담기록 작성
          </Button>
          <Button
            render={<Link href={`/records/leg/guardianship/new?personId=${personId}`} />}
            className="h-11 bg-accent-amber px-4 font-bold text-accent-stone hover:bg-accent-amber/85"
          >
            ＋ 후견감독보고서
          </Button>
        </div>
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
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-t-4 border-domain-leg-accent bg-white p-4 ring-1 ring-foreground/10">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-domain-leg-bg text-body font-bold text-domain-leg-text"
          >
            {client.fullName.slice(0, 2) || "당사자"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-body font-bold text-foreground">{client.fullName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StageBadge lifeStage={client.lifeStage} interactive={false} className="min-h-6 pr-2 text-[11px]" />
              <span className="text-caption text-muted-foreground">LEG 기록 {client.legRecordCount}건</span>
            </div>
          </div>
          {client.latestReportDue && (
            <p className="ml-auto rounded-(--br-sm) bg-domain-leg-bg px-2.5 py-1.5 text-caption font-bold text-domain-leg-text">
              다음 보고 예정 {formatDate(client.latestReportDue)}
            </p>
          )}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-headline-3 font-bold text-accent-stone">기록 목록</h2>
      {loading ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          불러오는 중...
        </p>
      ) : records.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          아직 작성된 법률·권리 기록이 없습니다. 위 버튼으로 첫 기록을 작성하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((r) => (
            <li
              key={r.recordId}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-foreground/10"
            >
              <span className="rounded-(--br-sm) bg-domain-leg-bg px-2 py-1 text-caption font-bold text-domain-leg-text">
                {r.recordType}
              </span>
              <span className="text-body font-semibold text-foreground">{r.typeLabel}</span>
              {r.reportKind === "initial" && (
                <span className="rounded-(--br-sm) bg-accent-amber/20 px-2 py-1 text-caption font-bold text-accent-stone">
                  최초 보고
                </span>
              )}
              <span className="text-caption text-muted-foreground">{formatDate(r.recordDate)}</span>
              {r.isDraft && (
                <span className="rounded-(--br-sm) bg-muted px-2 py-1 text-caption font-semibold text-muted-foreground">
                  임시저장
                </span>
              )}
              <div className="ml-auto">
                {r.requiresConfirmation && <ConfirmBadge confirmedAt={r.confirmedAt} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
