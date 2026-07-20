"use client";

import { useState } from "react";
import type { AccessLevel, DomainKey, Role } from "@ongil/validation";
import {
  revokeAllPermissions,
  updateGranteePermissions,
  type CellLevel,
  type PermissionMatrixRow,
} from "@/app/(app)/persons/[id]/permissions/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

/**
 * G-30 매트릭스 — 서버 컴포넌트가 넘긴 활성 권한(initialRows)을 표로 렌더한다. 셀 자체는
 * 읽기 전용 배지이고, 실제 변경은 행 우측 "⋮ 관리" 메뉴의 "✏️ 수정"(다이얼로그에서 여러 도메인을
 * 골라 "저장" 한 번에 반영) 또는 "🗑️ 전체 회수"로만 이루어진다(2026-07-20) — 이전엔 셀을 클릭하면
 * 확인 없이 바로 저장돼(회색→읽기→작성→편집 순환) 실수로 권한이 바뀌기 쉽다는 피드백에 따라
 * "클릭 즉시 저장"을 없애고 명시적 저장 단계가 있는 경로로만 변경할 수 있게 했다.
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

const CYCLE_ORDER_UI: CellLevel[] = ["none", "read", "write", "edit"];

const ROLE_LABEL: Record<Role, string> = {
  guardian: "보호자",
  person: "당사자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

export function PermissionMatrix({
  personId,
  initialRows,
}: {
  personId: string;
  initialRows: PermissionMatrixRow[];
}) {
  const [rows, setRows] = useState<PermissionMatrixRow[]>(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [manageTarget, setManageTarget] = useState<PermissionMatrixRow | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function onRevokeAll(row: PermissionMatrixRow) {
    if (revokingId) return;
    const ok = window.confirm(
      `${row.granteeName} 님의 모든 도메인 권한을 한 번에 회수하시겠습니까? 이 작업은 즉시 적용됩니다.`
    );
    if (!ok) return;
    setRevokingId(row.granteeId);
    setError(null);
    const res = await revokeAllPermissions(personId, row.granteeId);
    setRevokingId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRows((prev) => prev.map((r) => (r.granteeId === row.granteeId ? { ...r, cells: {} } : r)));
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
              <th className="px-3 py-3 text-center text-label font-semibold text-accent-stone">관리</th>
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
                  return (
                    <td key={d.key} className="p-1 text-center">
                      <span
                        aria-label={`${row.granteeName} · ${d.label} 현재 ${meta.label}`}
                        title={
                          row.cells[d.key]?.validUntil
                            ? `${meta.label} · ~${row.cells[d.key]?.validUntil}`
                            : meta.label
                        }
                        className="inline-flex h-11 w-full min-w-11 items-center justify-center rounded-(--br-sm) text-caption font-bold"
                        style={{ backgroundColor: meta.bg, color: meta.fg }}
                      >
                        {meta.label}
                      </span>
                    </td>
                  );
                })}
                <td className="p-1 text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          className="h-9 w-9 p-0 text-body"
                          aria-label={`${row.granteeName} 관리`}
                        />
                      }
                    >
                      ⋮
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setManageTarget(row)}>✏️ 수정</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 data-highlighted:bg-red-50"
                        onClick={() => onRevokeAll(row)}
                        disabled={revokingId === row.granteeId}
                      >
                        {revokingId === row.granteeId ? "회수 중..." : "🗑️ 전체 회수"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manageTarget && (
        <GranteeManageDialog
          personId={personId}
          row={manageTarget}
          onClose={() => setManageTarget(null)}
          onSaved={(cells) => {
            setRows((prev) =>
              prev.map((r) => (r.granteeId === manageTarget.granteeId ? { ...r, cells } : r))
            );
            setManageTarget(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * G-30 우측 "✏️ 수정" — 이해관계자 한 명의 6개 도메인 접근수준을 다이얼로그에서 한꺼번에 고른 뒤
 * "저장" 한 번으로 반영한다(매트릭스 셀 클릭의 즉시저장 방식과 별개 경로, updateGranteePermissions).
 */
function GranteeManageDialog({
  personId,
  row,
  onClose,
  onSaved,
}: {
  personId: string;
  row: PermissionMatrixRow;
  onClose: () => void;
  onSaved: (cells: PermissionMatrixRow["cells"]) => void;
}) {
  const [levels, setLevels] = useState<Record<DomainKey, CellLevel>>(() => {
    const init = {} as Record<DomainKey, CellLevel>;
    for (const d of DOMAINS) init[d.key] = row.cells[d.key]?.accessLevel ?? "none";
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const domains = DOMAINS.map((d) => ({ domain: d.key, accessLevel: levels[d.key] }));
    const res = await updateGranteePermissions(personId, row.granteeId, domains);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const cells: PermissionMatrixRow["cells"] = {};
    for (const d of DOMAINS) {
      if (levels[d.key] === "none") continue;
      cells[d.key] = {
        accessLevel: levels[d.key] as AccessLevel,
        validUntil: row.cells[d.key]?.validUntil ?? null,
      };
    }
    onSaved(cells);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPopup>
        <DialogTitle>{row.granteeName} 권한 일괄 수정</DialogTitle>
        <DialogDescription>
          {ROLE_LABEL[row.granteeRole] ?? row.granteeRole} · 도메인별 접근수준을 고른 뒤 저장하세요.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-3">
          {DOMAINS.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-3">
              <span className="text-body font-semibold text-foreground">{d.label}</span>
              <div className="flex gap-1">
                {CYCLE_ORDER_UI.map((level) => {
                  const meta = LEVEL[level];
                  const active = levels[d.key] === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLevels((prev) => ({ ...prev, [d.key]: level }))}
                      className="inline-flex h-9 w-16 items-center justify-center rounded-(--br-sm) text-caption font-bold outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-primary-600"
                      style={{
                        backgroundColor: meta.bg,
                        color: meta.fg,
                        opacity: active ? 1 : 0.35,
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-body font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <DialogClose render={<Button variant="outline" className="h-11" disabled={busy} />}>취소</DialogClose>
          <Button className="h-11 bg-accent-amber font-bold text-accent-stone" disabled={busy} onClick={save}>
            {busy ? "저장 중..." : "저장"}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
