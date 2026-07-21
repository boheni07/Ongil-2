"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SupportJournalSummary } from "@/app/(app)/journal/actions";
import { RecordDetailPane } from "@/components/records/RecordDetailPane";
import { Button } from "@/components/ui/button";

/**
 * S-13 일지 목록 — 기록관리(RecordManager)·타임라인과 동일한 좌(검색+목록)·우(상세) 분할
 * 구조로 재구성(2026-07-21, "다른 기능의 화면과 동일하게" 요청). 우측 상세는 공용
 * `RecordDetailPane`을 그대로 재사용하되(DAI-002는 `JournalReadView`로 이미 분기돼 있음),
 * "✎ 수정" 기본 링크(보호자 전용 `/persons/{id}/records/{id}/edit`)는 활동지원사 일지와 안
 * 맞으므로 `getEditHref`로 재정의해 임시저장 일지만 `/journals/{id}/edit`(이어서 작성)로 보낸다
 * — 이미 제출된 일지는 편집 버튼 자체를 숨긴다.
 */
export function JournalManager({ initialItems }: { initialItems: SupportJournalSummary[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialItems;
    return initialItems.filter((j) => (j.personName ?? "").toLowerCase().includes(q));
  }, [initialItems, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-1 font-extrabold text-foreground">일지 목록</h1>
          <p className="mt-1 text-body text-muted-foreground">
            최근 작성한 활동지원 일지 {initialItems.length}건 · 목록에서 일지를 선택하면 우측에 상세가
            표시됩니다.
          </p>
        </div>
        <Button
          render={<Link href="/journals/new" />}
          className="h-11 bg-accent-amber font-bold text-accent-stone hover:bg-[#f5bd5e]"
        >
          ＋ 새 일지 작성
        </Button>
      </div>

      <div className="mt-6 grid min-h-[420px] min-w-0 flex-1 gap-0 rounded-xl bg-white shadow-md ring-1 ring-foreground/10 lg:grid-cols-[320px_1fr]">
        <div className="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          <div className="p-3">
            <input
              type="text"
              aria-label="일지 검색"
              placeholder="🔍 이용자 이름으로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600"
            />
          </div>
          <ul className="flex flex-col">
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-caption text-muted-foreground">
                일지가 없습니다.
              </li>
            )}
            {filtered.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(j.id)}
                  aria-current={selectedId === j.id ? "true" : undefined}
                  className={`flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors ${
                    selectedId === j.id ? "bg-primary-50" : "hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    {j.personName ?? "이용자"}
                    {j.isDraft && (
                      <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                        임시저장
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-caption text-muted-foreground">
                    {j.serviceDate ?? j.recordDate.slice(0, 10)} · 실적 {j.serviceHours ?? "-"}시간
                    {j.scheduledHours !== null && ` · 계획 ${j.scheduledHours}시간`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          <RecordDetailPane
            recordId={selectedId}
            getEditHref={(detail) => (detail.isDraft ? `/journals/${detail.id}/edit` : null)}
          />
        </div>
      </div>
    </div>
  );
}
