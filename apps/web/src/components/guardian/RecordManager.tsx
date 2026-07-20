"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getRecordDetail,
  confirmRecord,
  type RecordListItem,
  type RecordDetail,
} from "@/app/(app)/persons/[id]/records/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { ConfirmCTA } from "@/components/records/ConfirmCTA";
import { RecordContentView } from "@/components/records/RecordContentView";
import { TherapyPlanReadView } from "@/components/records/TherapyPlanReadView";
import { IepReadView } from "@/components/records/IepReadView";
import { ObservationReadView } from "@/components/records/ObservationReadView";
import { BipReadView } from "@/components/records/BipReadView";
import { ItpReadView } from "@/components/records/ItpReadView";
import { SessionNoteReadView } from "@/components/records/SessionNoteReadView";
import { EvalReportReadView } from "@/components/records/EvalReportReadView";
import { IspReadView } from "@/components/records/IspReadView";
import { CaseConferenceReadView } from "@/components/records/CaseConferenceReadView";
import { TransitionPlanReadView } from "@/components/records/TransitionPlanReadView";
import { GuardianshipReportReadView } from "@/components/records/GuardianshipReportReadView";
import { AdvocacyConsultationReadView } from "@/components/records/AdvocacyConsultationReadView";
import { JournalReadView } from "@/components/records/JournalReadView";
import { SelfExpressionReadView } from "@/components/records/SelfExpressionReadView";
import { Button } from "@/components/ui/button";

/** record_type → 전용 읽기 전용 뷰. 매칭 안 되는 나머지(WEL-005 등)는 RecordContentView 폴백. */
const STRUCTURED_READ_VIEWS: Record<string, (props: { content: unknown }) => React.JSX.Element> = {
  "MED-005": TherapyPlanReadView,
  "EDU-001": IepReadView,
  "EDU-002": ObservationReadView,
  "EDU-003": BipReadView,
  "EDU-005": ItpReadView,
  "MED-006": SessionNoteReadView,
  "MED-007": EvalReportReadView,
  "WEL-004": IspReadView,
  "WEL-006": CaseConferenceReadView,
  "TRA-001": TransitionPlanReadView,
  "LEG-001": GuardianshipReportReadView,
  "LEG-002": AdvocacyConsultationReadView,
  "DAI-002": JournalReadView,
  "SELF-001": SelfExpressionReadView,
};

/**
 * G-20 기록 관리 — Split Pane(좌: 검색+목록 / 우: 상세).
 * docs/02-ia.md §3-3, 프로토타입 web-guardian.html 455~523줄.
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
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialItems;
    return initialItems.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.authorName?.toLowerCase().includes(q) ?? false)
    );
  }, [initialItems, query]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setConfirmError(null);
    getRecordDetail(selectedId).then((res) => {
      if (active) {
        setDetail(res);
        setDetailLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedId]);

  async function handleConfirm() {
    if (!detail) return;
    setConfirmBusy(true);
    setConfirmError(null);
    const res = await confirmRecord(detail.id);
    if (res.error) {
      setConfirmError(res.error);
      setConfirmBusy(false);
      return;
    }
    setDetail({ ...detail, confirmedAt: new Date().toISOString() });
    setConfirmBusy(false);
  }

  return (
    <div className="flex flex-1 flex-col">
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
        않는다(2026-07-19 피드백으로 발견). 56px 헤더 + 페이지 상하 패딩 + 이 페이지 자체
        헤더 블록의 대략치를 뺀 높이로 고정하고, 작은 화면을 위한 최소 높이를 둔다.
      */}
      <div className="mt-6 grid h-[calc(100vh-260px)] min-h-[420px] min-w-0 gap-0 rounded-xl bg-white shadow-md ring-1 ring-foreground/10 lg:grid-cols-[320px_1fr]">
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
          {detailLoading && <p className="text-body text-muted-foreground">불러오는 중...</p>}
          {!detailLoading && !detail && (
            <p className="text-body text-muted-foreground">기록을 선택해주세요.</p>
          )}
          {!detailLoading && detail && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <DomainChip domain={detail.domain} />
                  <h2 className="text-headline-2 font-bold text-foreground">{detail.title}</h2>
                </div>
                <Button
                  render={<Link href={`/persons/${personId}/records/${detail.id}/edit`} />}
                  variant="outline"
                  className="h-9"
                >
                  ✎ 수정
                </Button>
              </div>
              <p className="text-caption text-muted-foreground">
                👤 작성자 {detail.authorName ?? "알 수 없음"} · 🗓 {detail.recordDate.slice(0, 10)}
              </p>

              {detail.requiresConfirmation && !detail.confirmedAt && (
                <div className="rounded-(--br-md) bg-domain-dai-bg p-4 ring-1 ring-domain-dai-accent/30">
                  <p className="text-body text-foreground">
                    🔑 이 기록은 공식 문서로 <b>확인</b>이 필요합니다. 승인·반려가 아니라 내용을
                    확인했음을 남기는 절차입니다.
                  </p>
                  {confirmError && (
                    <p role="alert" className="mt-2 text-caption font-semibold text-red-600">
                      {confirmError}
                    </p>
                  )}
                  <ConfirmCTA
                    onConfirm={handleConfirm}
                    busy={confirmBusy}
                    className="mt-3 h-10 font-bold"
                  />
                </div>
              )}
              {detail.requiresConfirmation && detail.confirmedAt && (
                <ConfirmBadge confirmedAt={detail.confirmedAt} />
              )}

              {detail.isGuardianRecord ? (
                <GuardianBody content={detail.content} />
              ) : (
                <StructuredBody
                  recordType={detail.recordType}
                  content={detail.content}
                  guardianNote={detail.guardianNote}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GuardianBody({ content }: { content: unknown }) {
  const c = content as { title?: string; body?: string } | null;
  return (
    <div className="rounded-(--br-lg) border border-border bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold tracking-wide text-muted-foreground/80 uppercase">내용</p>
      <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed font-semibold text-foreground">
        {c?.body ?? ""}
      </p>
    </div>
  );
}

function StructuredBody({
  recordType,
  content,
  guardianNote,
}: {
  recordType: string;
  content: unknown;
  guardianNote: { title: string; body: string; editedAt: string } | null;
}) {
  const rest = { ...((content as Record<string, unknown>) ?? {}) };
  delete rest.guardianNote;
  const ReadView = STRUCTURED_READ_VIEWS[recordType];
  return (
    <div className="flex flex-col gap-4">
      {ReadView ? (
        <ReadView content={rest} />
      ) : (
        <div className="rounded-(--br-lg) border border-border bg-white p-5 shadow-sm">
          <p className="mb-4 text-[11px] font-bold tracking-wide text-muted-foreground/80 uppercase">
            원본 기록 내용
          </p>
          <RecordContentView content={rest} />
        </div>
      )}
      {guardianNote && (
        <div className="rounded-(--br-lg) bg-primary-50 p-5 ring-1 ring-primary-100">
          <p className="text-[11px] font-bold tracking-wide text-primary-700/80 uppercase">보호자 메모</p>
          <p className="mt-1.5 text-[15px] font-bold text-foreground">{guardianNote.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-body text-foreground">{guardianNote.body}</p>
        </div>
      )}
    </div>
  );
}
