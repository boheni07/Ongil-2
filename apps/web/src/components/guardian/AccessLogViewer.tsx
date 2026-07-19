"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DomainKey, Role } from "@ongil/validation";
import {
  getAccessLogs,
  type AccessLogActionKey,
  type AccessLogFilters,
  type AccessLogPage,
  type AccessLogRow,
} from "@/app/(app)/persons/[id]/access-logs/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { DateField } from "@/components/form/DateField";

/**
 * G-40 접근 로그 뷰어 — 필터(역할·도메인·날짜) + keyset 커서 무한 스크롤.
 * 초기 페이지는 서버 컴포넌트가 넘기고, 이후 페이지는 sentinel이 뷰포트에 들어오면
 * nextCursor로 getAccessLogs를 추가 호출해 append한다. "거부됨(deny)"은 범위 밖.
 * 프로토타입 web-guardian.html 676~701줄.
 */

/** 이해관계자 필터 대상 — 당사자·보호자는 제외(프로토타입 필터와 동일). */
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "teacher", label: "특수교사" },
  { value: "therapist", label: "치료사" },
  { value: "social_worker", label: "사회복지사" },
  { value: "supporter", label: "활동지원사" },
];

const ROLE_LABEL: Record<Role, string> = {
  guardian: "보호자",
  person: "당사자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

const DOMAIN_OPTIONS: DomainKey[] = ["MED", "EDU", "WEL", "DAI", "TRA", "LEG"];

/** 동작 배지 색상 — 프로토타입 act-* 클래스 톤. export는 보라 계열로 신규 지정. */
const ACTION_BADGE: Record<AccessLogActionKey, { label: string; bg: string; fg: string }> = {
  create: { label: "작성", bg: "#D1FAE5", fg: "#047857" },
  view: { label: "열람", bg: "#DBEAFE", fg: "#1D4ED8" },
  update: { label: "수정", bg: "#FEF3C7", fg: "#B45309" },
  export: { label: "내보내기", bg: "#EDE9FE", fg: "#6D28D9" },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AccessLogViewer({
  personId,
  personName,
  initialPage,
}: {
  personId: string;
  personName: string;
  initialPage: AccessLogPage;
}) {
  // 입력 중인 필터(draft) — "조회" 클릭 시에만 적용된다.
  const [draftRole, setDraftRole] = useState<"" | Role>("");
  const [draftDomain, setDraftDomain] = useState<"" | DomainKey>("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  const [items, setItems] = useState<AccessLogRow[]>(initialPage.items);
  const [cursor, setCursor] = useState<string | null>(initialPage.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필터 재조회·무한스크롤 요청이 겹칠 때 오래된 응답이 최신 목록을 덮어쓰지 않도록 세대(generation) 추적.
  const genRef = useRef(0);
  const filtersRef = useRef<AccessLogFilters>({});

  const roleFilterId = useId();
  const domainFilterId = useId();
  const fromFilterId = useId();
  const toFilterId = useId();

  function buildFilters(): AccessLogFilters {
    const f: AccessLogFilters = {};
    if (draftRole) f.role = draftRole;
    if (draftDomain) f.domain = draftDomain;
    if (draftFrom) f.dateFrom = draftFrom;
    if (draftTo) f.dateTo = draftTo;
    return f;
  }

  async function onApply() {
    const filters = buildFilters();
    filtersRef.current = filters;
    const gen = ++genRef.current;
    setReloading(true);
    setError(null);
    try {
      const page = await getAccessLogs(personId, filters);
      if (gen !== genRef.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch {
      if (gen !== genRef.current) return;
      setError("접근 로그를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      if (gen === genRef.current) setReloading(false);
    }
  }

  const loadMore = useCallback(async () => {
    if (loadingMore || reloading || cursor === null) return;
    const gen = genRef.current;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await getAccessLogs(personId, filtersRef.current, cursor);
      if (gen !== genRef.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      if (gen !== genRef.current) return;
      setError("추가 로그를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      if (gen === genRef.current) setLoadingMore(false);
    }
  }, [personId, cursor, loadingMore, reloading]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || cursor === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, cursor]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-headline-1 font-extrabold text-foreground">접근 로그</h1>
      <p className="mt-1 text-body text-muted-foreground">
        {personName} · 누가, 언제, 어떤 기록에 접근했는지 확인합니다.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-(--br-md) bg-white p-4 ring-1 ring-foreground/10">
        <FilterField id={roleFilterId} label="역할">
          <select
            id={roleFilterId}
            value={draftRole}
            onChange={(e) => setDraftRole(e.target.value as "" | Role)}
            className="min-h-11 rounded-(--br-md) border border-border bg-white px-3 text-body text-foreground outline-none focus-visible:border-primary-600"
          >
            <option value="">전체 역할</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField id={domainFilterId} label="도메인">
          <select
            id={domainFilterId}
            value={draftDomain}
            onChange={(e) => setDraftDomain(e.target.value as "" | DomainKey)}
            className="min-h-11 rounded-(--br-md) border border-border bg-white px-3 text-body text-foreground outline-none focus-visible:border-primary-600"
          >
            <option value="">전체 도메인</option>
            {DOMAIN_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABEL[d]}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField id={fromFilterId} label="시작일">
          <DateField
            id={fromFilterId}
            value={draftFrom}
            max={draftTo || undefined}
            onChange={setDraftFrom}
            className="min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3 text-body text-foreground outline-none focus-visible:border-primary-600"
          />
        </FilterField>

        <FilterField id={toFilterId} label="종료일">
          <DateField
            id={toFilterId}
            value={draftTo}
            min={draftFrom || undefined}
            onChange={setDraftTo}
            className="min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3 text-body text-foreground outline-none focus-visible:border-primary-600"
          />
        </FilterField>

        <button
          type="button"
          onClick={() => void onApply()}
          disabled={reloading}
          className="min-h-11 rounded-(--br-md) bg-primary-600 px-5 font-bold text-white outline-none transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50"
        >
          {reloading ? "조회 중…" : "조회"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-(--br-md) bg-white ring-1 ring-foreground/10">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="bg-muted/60 text-left text-label font-semibold text-accent-stone">
              <th scope="col" className="px-4 py-3">
                일시
              </th>
              <th scope="col" className="px-4 py-3">
                이해관계자
              </th>
              <th scope="col" className="px-4 py-3">
                도메인
              </th>
              <th scope="col" className="px-4 py-3">
                동작
              </th>
              <th scope="col" className="px-4 py-3">
                대상 기록
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !reloading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-body text-muted-foreground">
                  조건에 맞는 접근 기록이 없습니다.
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id} className="border-t border-border align-middle">
                <td className="whitespace-nowrap px-4 py-3 text-caption text-muted-foreground">
                  {formatDateTime(row.accessedAt)}
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  {row.actorName ?? "알 수 없음"}
                  {row.actorRole && (
                    <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                      {ROLE_LABEL[row.actorRole]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.domain ? <DomainChip domain={row.domain} /> : <span className="text-caption text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <ActionBadge action={row.action} />
                </td>
                <td className="px-4 py-3 text-foreground">{row.recordTitle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      <div aria-live="polite" className="mt-4 pb-2 text-center text-caption text-muted-foreground">
        {loadingMore
          ? "이전 로그를 불러오는 중…"
          : cursor === null && items.length > 0
            ? "더 이상 기록이 없습니다."
            : ""}
      </div>
    </div>
  );
}

const DOMAIN_LABEL: Record<DomainKey, string> = {
  MED: "의료",
  EDU: "교육",
  WEL: "복지",
  DAI: "일상",
  TRA: "전환",
  LEG: "법률",
};

function FilterField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption font-semibold text-accent-stone">
        {label}
      </label>
      {children}
    </div>
  );
}

function ActionBadge({ action }: { action: AccessLogActionKey }) {
  const meta = ACTION_BADGE[action];
  return (
    <span
      className="inline-flex h-6 items-center rounded-(--br-sm) px-2 text-caption font-bold"
      style={{ backgroundColor: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}
