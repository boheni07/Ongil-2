"use client";

import { useMemo, useState } from "react";
import type { ServiceUsageRow } from "@/app/(app)/records/isp/actions";
import { DomainChip } from "@/components/timeline/DomainChip";

/**
 * W-17 서비스 이용 현황(프로토타입 web-social-worker.html 437~461줄).
 * 상태 필터(전체/이용중/대기/종료) + 표(당사자/서비스/도메인칩/제공기관/기간/상태배지).
 * 전체 행을 서버(getServiceUsage)에서 받아 클라이언트에서 상태별로 필터한다.
 * 상태 라벨: active=이용중, paused=대기, ended=종료 (WEL-005.services[].status).
 */

type StatusFilter = "all" | "active" | "paused" | "ended";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "active", label: "이용중" },
  { key: "paused", label: "대기" },
  { key: "ended", label: "종료" },
];

const STATUS_META: Record<
  ServiceUsageRow["status"],
  { label: string; className: string }
> = {
  active: { label: "이용중", className: "bg-primary-50 text-primary-700" },
  paused: { label: "대기", className: "bg-accent-amber/20 text-[#B56F10]" },
  ended: { label: "종료", className: "bg-muted text-muted-foreground" },
};

export function ServiceUsageTable({ rows }: { rows: ServiceUsageRow[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter]
  );

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">서비스 이용 현황</h1>
      <p className="mt-1 text-body text-muted-foreground">
        담당 당사자별 복지 서비스 이용 및 연계 상태
      </p>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="상태 필터">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              className={`min-h-11 rounded-(--br-md) border px-4 text-body font-semibold transition-colors ${
                on
                  ? "border-domain-wel-accent bg-domain-wel-bg text-domain-wel-text"
                  : "border-border bg-white text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          표시할 서비스 이용 기록이 없습니다.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[720px] border-collapse bg-white text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-caption text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-semibold">당사자</th>
                <th scope="col" className="px-4 py-3 font-semibold">서비스</th>
                <th scope="col" className="px-4 py-3 font-semibold">도메인</th>
                <th scope="col" className="px-4 py-3 font-semibold">제공기관</th>
                <th scope="col" className="px-4 py-3 font-semibold">기간</th>
                <th scope="col" className="px-4 py-3 font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const meta = STATUS_META[r.status];
                return (
                  <tr key={i} className="border-b border-border last:border-0 text-body">
                    <td className="px-4 py-3 font-semibold text-foreground">{r.personName}</td>
                    <td className="px-4 py-3 text-foreground">{r.serviceName}</td>
                    <td className="px-4 py-3">
                      <DomainChip domain={r.domain} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.provider || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.period}</td>
                    <td className="px-4 py-3">
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
  );
}
