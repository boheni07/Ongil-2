"use client";

import { useEffect, useMemo, useState } from "react";
import type { DomainKey } from "@ongil/shared";
import type { EmergencyInfoInput } from "@ongil/validation";
import type { TimelineItem } from "@/app/(app)/records/iep/actions";
import { TimelineStream } from "@/components/timeline/TimelineStream";
import { TimelineLane } from "@/components/timeline/TimelineLane";
import { StageBadge, type LifeStage } from "@/components/lifecycle/StageBadge";
import { computeLifeStage } from "@/lib/lifecycle";
import { RecordDetailPane } from "@/components/records/RecordDetailPane";
import { PinnedCard } from "@/components/timeline/PinnedCard";

/**
 * 생애주기 타임라인 최상위 뷰(구 EduTimeline). T-20/W-20/TH-20/G-10 공용.
 * 스트림 뷰(날짜 내림차순) ↔ 레인 뷰(도메인별 컬럼) 토글 + 도메인 필터.
 * emergencyInfo가 주어질 때만 PinnedCard가 노출된다(전 역할 호출부 공통 지원).
 * 2026-07-20: PinnedCard를 스트림 목록에서 분리해 뷰·필터와 무관하게 항상 최상단에
 * 고정 노출한다(스크롤되는 좌측 목록 안에 있으면 필터링·스크롤에 따라 안 보일 수 있었음).
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
  personId,
}: {
  items: TimelineItem[];
  personName: string;
  emergencyInfo?: EmergencyInfoInput | null;
  domainFilterDefault?: DomainKey | "ALL";
  /** 있으면 헤더 StageBadge·단계 필터·레인뷰 전환 구분선을 노출한다(없으면 하위 호환으로 생략). */
  birthDate?: string;
  /** 있으면 스트림 뷰 우측 상세 패널의 "✎ 수정" 링크가 뜬다. */
  personId?: string;
}) {
  const [view, setView] = useState<View>("stream");
  const [domainFilter, setDomainFilter] = useState<DomainKey | "ALL">(domainFilterDefault);
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // 스트림 뷰 우측 상세 패널의 기본 선택 — 필터가 바뀌어 선택 항목이 목록에서 사라지면
  // 첫 번째 항목으로 다시 맞춘다(2026-07-20, 목록 클릭→상세 연동 신설).
  useEffect(() => {
    if (!filtered.some((it) => it.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  return (
    /*
      2026-07-20 피드백: 스트림 뷰 목록/상세가 PinnedCard(응급정보, 알레르기·복용약·연락처
      개수에 따라 높이가 들쭉날쭉함) 때문에 뷰포트를 넘어가던 문제 → 2026-07-21 `(app)/layout.tsx`
      의 main이 h-full 체인으로 실제 뷰포트 높이를 물려주게 되면서, 이 컴포넌트는 그 남은
      공간을 h-full로 그대로 채우고, 그리드는 flex-1 min-h-0으로 "PinnedCard 등 나머지가
      차지하고 남은 공간"만 정확히 채운다 — 더 이상 magic-number calc가 필요 없다.
    */
    <div className="flex h-full min-h-0 flex-col">
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

      {emergencyInfo !== undefined && (
        <div className="mt-5">
          <PinnedCard emergencyInfo={emergencyInfo ?? null} personName={personName} />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
          표시할 기록이 없습니다.
        </p>
      ) : view === "stream" ? (
        /*
          스트림 뷰만 좌(목록)·우(상세) 분할한다(2026-07-20, "목록 선택하면 우측에 상세보기"
          요청 반영) — 레인 뷰는 도메인 병렬 컬럼 자체가 가로로 넓어 분할과 안 맞아 그대로 둔다.
          RecordManager와 동일하게 좌우가 각자 독립 스크롤되도록 h-full(부모의 flex-1 min-h-0가
          실제 높이를 결정)로 채운다.
        */
        <div className="mt-6 grid min-h-0 min-w-0 flex-1 gap-0 rounded-xl bg-white shadow-md ring-1 ring-foreground/10 lg:grid-cols-[380px_1fr]">
          <div className="min-h-0 overflow-y-auto border-b border-border p-4 lg:border-b-0 lg:border-r">
            <TimelineStream
              items={filtered}
              birthDate={birthDate}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="min-h-0 overflow-y-auto p-5">
            <RecordDetailPane recordId={selectedId} personId={personId} />
          </div>
        </div>
      ) : (
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <TimelineLane items={filtered} birthDate={birthDate} />
        </div>
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
