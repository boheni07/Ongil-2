"use client";

import { useMemo, useState } from "react";
import type { DomainKey } from "@ongil/shared";
import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { DomainChip } from "@/components/timeline/DomainChip";

/**
 * T-20 교육 타임라인(프로토타입 web-teacher.html 499~538줄).
 * 스트림 뷰(날짜 내림차순 카드) ↔ 레인 뷰(도메인별 세로 컬럼) 토글 + 도메인 필터.
 * 응급 대응 정보는 상단 고정 카드(핀)로 노출한다. 데이터는 getTimeline(personId) 결과 그대로 사용한다.
 */

const DOMAIN_LABELS: Record<DomainKey, string> = {
  MED: "의료",
  EDU: "교육",
  WEL: "복지",
  DAI: "일상",
  TRA: "전환",
  LEG: "법률",
};

type View = "stream" | "lane";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function EduTimeline({
  items,
  personName,
}: {
  items: TimelineItem[];
  personName: string;
}) {
  const [view, setView] = useState<View>("stream");
  const [domainFilter, setDomainFilter] = useState<DomainKey | "ALL">("ALL");

  const domains = useMemo(() => {
    const set = new Set<DomainKey>();
    for (const it of items) set.add(it.domain);
    return [...set];
  }, [items]);

  const filtered = useMemo(
    () => (domainFilter === "ALL" ? items : items.filter((it) => it.domain === domainFilter)),
    [items, domainFilter]
  );

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">타임라인 · {personName}</h1>
      <p className="mt-1 text-body text-muted-foreground">기록을 시간순으로 확인합니다.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-(--br-md) border border-border p-1"
          role="tablist"
          aria-label="타임라인 보기 방식"
        >
          <ViewButton active={view === "stream"} onClick={() => setView("stream")}>
            스트림 뷰
          </ViewButton>
          <ViewButton active={view === "lane"} onClick={() => setView("lane")}>
            레인 뷰
          </ViewButton>
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-2">
          <span className="text-caption font-semibold text-accent-stone">필터</span>
          <select
            className="min-h-11 rounded-(--br-md) border border-border bg-white px-3 text-body outline-none focus-visible:border-primary-600"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value as DomainKey | "ALL")}
          >
            <option value="ALL">전체 도메인</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border-l-4 border-domain-med-accent bg-domain-med-bg p-3.5">
        <span aria-hidden="true">📌</span>
        <p className="text-body text-domain-med-text">
          <b>응급 대응 정보</b> — 학생 프로필의 응급 정보를 확인하세요. (핀 고정 항목)
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          표시할 기록이 없습니다.
        </p>
      ) : view === "stream" ? (
        <StreamView items={filtered} />
      ) : (
        <LaneView items={filtered} domains={domains} />
      )}
    </div>
  );
}

function StreamView({ items }: { items: TimelineItem[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {items.map((it) => (
        <li
          key={it.id}
          className={`rounded-xl bg-white p-4 ring-1 ring-foreground/10 ${
            it.isMilestone ? "border-l-4 border-accent-amber" : ""
          }`}
        >
          <div className="text-caption font-semibold text-muted-foreground">{formatDate(it.date)}</div>
          <h4 className="mt-1 text-body font-bold text-foreground">{it.title}</h4>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <DomainChip domain={it.domain} />
            {it.isMilestone && (
              <span className="rounded-(--br-sm) bg-accent-amber/25 px-2 py-0.5 text-[12px] font-semibold text-[#B56F10]">
                ◆ 이정표
              </span>
            )}
            {it.tags.map((t) => (
              <span
                key={t}
                className="rounded-(--br-sm) bg-muted px-2 py-0.5 text-[12px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function LaneView({ items, domains }: { items: TimelineItem[]; domains: DomainKey[] }) {
  const lanes = domains.filter((d) => items.some((it) => it.domain === d));
  return (
    <div className="mt-6 overflow-x-auto">
      <div className="flex gap-3" style={{ minWidth: `${lanes.length * 220}px` }}>
        {lanes.map((d) => {
          const laneItems = items.filter((it) => it.domain === d);
          return (
            <div key={d} className="flex w-56 shrink-0 flex-col gap-2">
              <div className="sticky top-0">
                <DomainChip domain={d} className="h-7 text-body" />
              </div>
              {laneItems.map((it) => (
                <div key={it.id} className="rounded-(--br-md) bg-white p-3 ring-1 ring-foreground/10">
                  <div className="text-caption font-semibold text-muted-foreground">
                    {formatDate(it.date).slice(5)}
                  </div>
                  <div className="mt-0.5 text-body font-semibold text-foreground">
                    {it.title}
                    {it.isMilestone && <span className="text-accent-amber"> ◆</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ViewButton({
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
      className={`min-h-11 rounded-(--br-md) px-4 text-label font-semibold transition-colors ${
        active ? "bg-domain-edu-bg text-domain-edu-text" : "text-muted-foreground hover:bg-muted/60"
      }`}
    >
      {children}
    </button>
  );
}
