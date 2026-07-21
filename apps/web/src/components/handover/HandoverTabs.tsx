"use client";

import { useState } from "react";
import Link from "next/link";
import { acknowledgeHandover, type HandoverSummary } from "@/app/(app)/handovers/actions";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { HandoverPriorityBadge } from "@/components/handover/HandoverPriorityBadge";
import { Button } from "@/components/ui/button";

/**
 * S-20 인계인수 목록. docs/04-workflow.md Flow-S-02.
 * [받은 인계] / [보낸 인계] 두 탭. 받은 인계는 서버가 이미 미확인 우선 정렬해서 주므로
 * 프론트는 순서를 그대로 렌더한다. 각 미확인 건에만 "확인했습니다" CTA를 노출하고,
 * 확인 성공 시 낙관적으로 acknowledgedAt을 채워 즉시 반영(실패 시 롤백)한다.
 */

type Tab = "received" | "sent";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function HandoverTabs({
  received,
  sent,
}: {
  received: HandoverSummary[];
  sent: HandoverSummary[];
}) {
  const [tab, setTab] = useState<Tab>("received");
  const [receivedItems, setReceivedItems] = useState(received);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAck(id: string) {
    setBusyId(id);
    setError(null);
    const ackAt = new Date().toISOString();
    const snapshot = receivedItems;
    // 낙관적 업데이트 — 즉시 확인됨으로 반영.
    setReceivedItems((items) =>
      items.map((it) => (it.id === id ? { ...it, acknowledgedAt: ackAt } : it))
    );
    const res = await acknowledgeHandover(id);
    setBusyId(null);
    if (res.error) {
      setReceivedItems(snapshot); // 롤백
      setError(res.error);
    }
  }

  const unreadCount = receivedItems.filter((it) => !it.acknowledgedAt).length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-1 font-extrabold text-foreground">인계인수</h1>
          <p className="mt-1 text-body text-muted-foreground">
            다음 지원사에게 전달할 인계 사항을 주고받습니다.
          </p>
        </div>
        <Button render={<Link href="/handovers/new" />} className="h-11 font-bold">
          + 인계인수 작성
        </Button>
      </div>

      <div role="tablist" aria-label="인계인수 목록" className="mt-6 flex gap-1 border-b border-border">
        <TabButton active={tab === "received"} onClick={() => setTab("received")}>
          받은 인계
          {unreadCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "sent"} onClick={() => setTab("sent")}>
          보낸 인계
        </TabButton>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      {tab === "received" ? (
        <div role="tabpanel" className="mt-5 flex flex-col gap-3">
          {receivedItems.length === 0 ? (
            <EmptyState message="받은 인계인수가 없습니다." />
          ) : (
            receivedItems.map((it) => (
              <HandoverCard key={it.id} item={it} direction="received">
                {!it.acknowledgedAt ? (
                  <Button
                    className="mt-3 h-11 font-bold"
                    disabled={busyId === it.id}
                    onClick={() => void handleAck(it.id)}
                  >
                    {busyId === it.id ? "처리 중..." : "확인했습니다"}
                  </Button>
                ) : (
                  <div className="mt-3">
                    <ConfirmBadge confirmedAt={it.acknowledgedAt} />
                  </div>
                )}
              </HandoverCard>
            ))
          )}
        </div>
      ) : (
        <div role="tabpanel" className="mt-5 flex flex-col gap-3">
          {sent.length === 0 ? (
            <EmptyState message="보낸 인계인수가 없습니다." />
          ) : (
            sent.map((it) => (
              <HandoverCard key={it.id} item={it} direction="sent">
                <div className="mt-3">
                  <ConfirmBadge
                    confirmedAt={it.acknowledgedAt}
                    confirmerName={it.acknowledgedAt ? it.toUserName : null}
                  />
                </div>
              </HandoverCard>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px flex min-h-11 items-center border-b-2 px-4 text-body font-semibold transition-colors ${
        active
          ? "border-primary-600 text-primary-700"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function HandoverCard({
  item,
  direction,
  children,
}: {
  item: HandoverSummary;
  direction: "received" | "sent";
  children: React.ReactNode;
}) {
  const counterpart =
    direction === "received"
      ? `${item.fromUserName ?? "담당자"}님 → 나`
      : `나 → ${item.toUserName ?? "담당자"}님`;

  return (
    <article className="rounded-xl bg-white p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label font-bold text-foreground">{item.personName ?? "이용자"} 님</span>
        <HandoverPriorityBadge priority={item.priority} />
        <span className="text-caption text-muted-foreground">{formatDateTime(item.createdAt)}</span>
      </div>
      <p className="mt-1 text-caption text-muted-foreground">{counterpart}</p>
      <p className="mt-3 whitespace-pre-wrap text-body text-foreground">{item.content}</p>
      {children}
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-white p-8 text-center ring-1 ring-foreground/10">
      <p className="text-body text-muted-foreground">{message}</p>
    </div>
  );
}
