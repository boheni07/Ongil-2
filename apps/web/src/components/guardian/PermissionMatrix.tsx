"use client";

import { useState } from "react";
import type { AccessLevel, DomainKey, Role } from "@ongil/validation";
import {
  cyclePermissionCell,
  type CellLevel,
  type PermissionMatrixRow,
} from "@/app/(app)/persons/[id]/permissions/actions";

/**
 * G-30 매트릭스 셀 상호작용 — 서버 컴포넌트가 넘긴 활성 권한(initialRows)을 표로 렌더하고,
 * 셀 클릭 시 cyclePermissionCell로 회색→읽기→작성→편집을 순환한다(응답의 newLevel로 즉시 갱신).
 * 셀 배경색은 프로토타입(web-guardian.html) 4색 상태색을 인라인 스타일로 그대로 쓴다.
 */

const DOMAINS: { key: DomainKey; label: string }[] = [
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

const LEVEL: Record<CellLevel, { bg: string; fg: string; label: string }> = {
  none: { bg: "#F3F4F6", fg: "#6B7280", label: "없음" },
  read: { bg: "#3B82F6", fg: "#FFFFFF", label: "읽기" },
  write: { bg: "#10B981", fg: "#FFFFFF", label: "작성" },
  edit: { bg: "#F59E0B", fg: "#FFFFFF", label: "편집" },
};

const ROLE_LABEL: Record<Role, string> = {
  guardian: "보호자",
  person: "당사자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

function cellKey(granteeId: string, domain: DomainKey) {
  return `${granteeId}:${domain}`;
}

export function PermissionMatrix({
  personId,
  initialRows,
}: {
  personId: string;
  initialRows: PermissionMatrixRow[];
}) {
  const [rows, setRows] = useState<PermissionMatrixRow[]>(initialRows);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCellClick(granteeId: string, domain: DomainKey) {
    const key = cellKey(granteeId, domain);
    if (pending) return;
    setPending(key);
    setError(null);

    const res = await cyclePermissionCell(personId, granteeId, domain);
    if (res.error) {
      setError(res.error);
      setPending(null);
      return;
    }

    setRows((prev) =>
      prev.map((r) => {
        if (r.granteeId !== granteeId) return r;
        const cells = { ...r.cells };
        if (res.newLevel === "none") {
          delete cells[domain];
        } else {
          cells[domain] = {
            accessLevel: res.newLevel as AccessLevel,
            validUntil: cells[domain]?.validUntil ?? null,
          };
        }
        return { ...r, cells };
      })
    );
    setPending(null);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-(--br-md) bg-white p-8 text-center ring-1 ring-foreground/10">
        <p className="text-4xl" aria-hidden="true">
          🔐
        </p>
        <h2 className="mt-3 text-headline-3 font-bold text-foreground">아직 부여된 권한이 없습니다</h2>
        <p className="mt-2 text-body text-muted-foreground">
          아래 “＋ 새 권한 부여”로 협력자에게 도메인별 접근 권한을 부여할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-(--br-md) ring-1 ring-foreground/10">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="bg-muted/60">
              <th className="sticky left-0 z-1 bg-muted/60 px-4 py-3 text-left text-label font-semibold text-accent-stone">
                이해관계자
              </th>
              {DOMAINS.map((d) => (
                <th key={d.key} className="px-3 py-3 text-center text-label font-semibold text-accent-stone">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.granteeId} className="border-t border-border">
                <th
                  scope="row"
                  className="sticky left-0 z-1 bg-white px-4 py-2 text-left font-semibold text-foreground"
                >
                  {row.granteeName}
                  <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                    {ROLE_LABEL[row.granteeRole] ?? row.granteeRole}
                  </span>
                </th>
                {DOMAINS.map((d) => {
                  const level: CellLevel = row.cells[d.key]?.accessLevel ?? "none";
                  const meta = LEVEL[level];
                  const key = cellKey(row.granteeId, d.key);
                  const busy = pending === key;
                  return (
                    <td key={d.key} className="p-1 text-center">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onCellClick(row.granteeId, d.key)}
                        aria-label={`${row.granteeName} · ${d.label} 현재 ${meta.label}. 클릭하여 변경`}
                        title={
                          row.cells[d.key]?.validUntil
                            ? `${meta.label} · ~${row.cells[d.key]?.validUntil}`
                            : meta.label
                        }
                        className="inline-flex h-11 w-full min-w-11 items-center justify-center rounded-(--br-sm) text-caption font-bold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50"
                        style={{ backgroundColor: meta.bg, color: meta.fg }}
                      >
                        {busy ? "…" : meta.label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
