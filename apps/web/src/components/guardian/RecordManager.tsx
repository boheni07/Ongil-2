"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RecordListItem } from "@/app/(app)/persons/[id]/records/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { RecordDetailPane } from "@/components/records/RecordDetailPane";
import { Button } from "@/components/ui/button";

/**
 * G-20 기록 관리 — Split Pane(좌: 검색+목록 / 우: 상세).
 * docs/02-ia.md §3-3, 프로토타입 web-guardian.html 455~523줄.
 * 우측 상세는 `RecordDetailPane`(2026-07-20, 타임라인과 공용으로 분리)이 전담한다.
 */
export function RecordManager({
  personId,
  personName,
  initialItems,
}: {
  personId: string;
  personName: string;
  initialItems: RecordListItem[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialItems;
    return initialItems.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.authorName?.toLowerCase().includes(q) ?? false)
    );
  }, [initialItems, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-1 font-extrabold text-foreground">기록 관리</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {personName} · 목록에서 기록을 선택하면 우측에 상세가 표시됩니다. 보호자는 모든 도메인의
            기록을 직접 작성·수정할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href={`/persons/${personId}/records/express`} />}
            variant="outline"
            className="h-11 font-semibold"
          >
            🙂 대신 자기표현 남기기
          </Button>
          <Button
            render={<Link href={`/persons/${personId}/records/new`} />}
            className="h-11 bg-accent-amber font-bold text-accent-stone hover:bg-[#f5bd5e]"
          >
            ＋ 새 기록 작성
          </Button>
        </div>
      </div>

      {/*
        좌우 패널이 각자 독립적으로 스크롤되려면 그리드 자체가 고정 높이를 가져야 한다 —
        overflow-y-auto만으로는 부모가 콘텐츠에 맞춰 계속 늘어나 절대 스크롤이 발생하지
        않는다(2026-07-19 피드백으로 발견). 2026-07-21부터는 `(app)/layout.tsx`의 main이
        h-full 체인으로 실제 뷰포트 높이를 물려주므로, 이 컴포넌트는 magic-number calc 없이
        flex-1 min-h-0만으로 "남은 공간 전부"를 정확히 채운다.
      */}
      <div className="mt-6 grid min-h-[420px] min-w-0 flex-1 gap-0 rounded-xl bg-white shadow-md ring-1 ring-foreground/10 lg:grid-cols-[320px_1fr]">
        <div className="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          <div className="p-3">
            <input
              type="text"
              aria-label="기록 검색"
              placeholder="🔍 기록 검색 (제목·작성자)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600"
            />
          </div>
          <ul className="flex flex-col">
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-caption text-muted-foreground">
                기록이 없습니다.
              </li>
            )}
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  aria-current={selectedId === r.id ? "true" : undefined}
                  className={`flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors ${
                    selectedId === r.id ? "bg-primary-50" : "hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    {r.title}
                    <DomainChip domain={r.domain} />
                    {r.isDraft && (
                      <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                        임시저장
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-caption text-muted-foreground">
                    {r.authorName ?? "알 수 없음"} · {r.recordDate.slice(0, 10)}
                    {r.requiresConfirmation && <ConfirmBadge confirmedAt={r.confirmedAt} />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          <RecordDetailPane recordId={selectedId} personId={personId} />
        </div>
      </div>
    </div>
  );
}
