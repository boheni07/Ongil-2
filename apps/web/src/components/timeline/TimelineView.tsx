"use client";

import { useMemo, useState } from "react";
import type { DomainKey } from "@ongil/shared";
import type { EmergencyInfoInput } from "@ongil/validation";
import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { TimelineStream } from "@/components/timeline/TimelineStream";
import { TimelineLane } from "@/components/timeline/TimelineLane";
import { StageBadge, type LifeStage } from "@/components/lifecycle/StageBadge";
import { computeLifeStage } from "@/lib/lifecycle";

/**
 * 생애주기 타임라인 최상위 뷰(구 EduTimeline). T-20/W-20/TH-20/G-10 공용.
 * 스트림 뷰(날짜 내림차순) ↔ 레인 뷰(도메인별 컬럼) 토글 + 도메인 필터.
 * emergencyInfo가 주어질 때만 스트림 상단에 PinnedCard가 노출된다(G-10 전용).
 * docs/03-uiux.md §6-2·§8.
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
type StageFilter = LifeStage | "ALL";

const STAGE_FILTER_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: "ALL", label: "전체 단계" },
  { value: "infant", label: "영유아기" },
  { value: "child", label: "아동기" },
  { value: "youth_transition", label: "청소년 전환기" },
  { value: "adult", label: "성인기" },
  { value: "senior", label: "노년기" },
];

export function TimelineView({
  items,
  personName,
  emergencyInfo,
  domainFilterDefault = "ALL",
  birthDate,
}: {
  items: TimelineItem[];
  personName: string;
  emergencyInfo?: EmergencyInfoInput | null;
  domainFilterDefault?: DomainKey | "ALL";
  /** 있으면 헤더 StageBadge·단계 필터·레인뷰 전환 구분선을 노출한다(없으면 하위 호환으로 생략). */
  birthDate?: string;
}) {
  const [view, setView] = useState<View>("stream");
  const [domainFilter, setDomainFilter] = useState<DomainKey | "ALL">(domainFilterDefault);
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");

  const domains = useMemo(() => {
    const set = new Set<DomainKey>();
    for (const it of items) set.add(it.domain);
    return [...set];
  }, [items]);

  const filtered = useMemo(() => {
    let out = domainFilter === "ALL" ? items : items.filter((it) => it.domain === domainFilter);
    // 단계 필터: 현재 나이가 아니라 "그 기록이 작성된 시점"의 life_stage로 분류한다.
    if (birthDate && stageFilter !== "ALL") {
      out = out.filter((it) => computeLifeStage(birthDate, new Date(it.date)) === stageFilter);
    }
    return out;
  }, [items, domainFilter, stageFilter, birthDate]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-headline-2 font-extrabold text-foreground">타임라인 · {personName}</h1>
        {birthDate && <StageBadge lifeStage={computeLifeStage(birthDate)} />}
      </div>
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
        {birthDate && (
          <label className="flex items-center gap-2">
            <span className="text-caption font-semibold text-accent-stone">생애주기 단계</span>
            <select
              className="min-h-11 rounded-(--br-md) border border-border bg-white px-3 text-body outline-none focus-visible:border-primary-600"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as StageFilter)}
            >
              {STAGE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
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

      {filtered.length === 0 && emergencyInfo === undefined ? (
        <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          표시할 기록이 없습니다.
        </p>
      ) : view === "stream" ? (
        <TimelineStream items={filtered} personName={personName} emergencyInfo={emergencyInfo} />
      ) : (
        <TimelineLane items={filtered} birthDate={birthDate} />
      )}
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
