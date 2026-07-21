"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRecordDetail,
  confirmRecord,
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
import { ServiceUsageReadView } from "@/components/records/ServiceUsageReadView";
import { Button } from "@/components/ui/button";

/**
 * record_type → 전용 읽기 전용 뷰. GEN-001(자유기록)은 이 맵 밖에서 `GuardianBody`가 따로
 * 처리한다 — 16종 record_type 전부가 여기 아니면 GuardianBody여야 한다.
 */
const STRUCTURED_READ_VIEWS: Record<string, (props: { content: unknown }) => React.JSX.Element> = {
  "MED-005": TherapyPlanReadView,
  "EDU-001": IepReadView,
  "EDU-002": ObservationReadView,
  "EDU-003": BipReadView,
  "EDU-005": ItpReadView,
  "MED-006": SessionNoteReadView,
  "MED-007": EvalReportReadView,
  "WEL-004": IspReadView,
  "WEL-005": ServiceUsageReadView,
  "WEL-006": CaseConferenceReadView,
  "TRA-001": TransitionPlanReadView,
  "LEG-001": GuardianshipReportReadView,
  "LEG-002": AdvocacyConsultationReadView,
  "DAI-002": JournalReadView,
  "SELF-001": SelfExpressionReadView,
};

/**
 * G-20 기록관리·타임라인 공용 우측 상세 패널(2026-07-20, RecordManager.tsx에서 분리) —
 * 기록 하나를 선택하면 이 컴포넌트가 조회·확인(Confirmation)·전용 ReadView 렌더까지 전담한다.
 * `personId`를 주면 "✎ 수정" 링크가 뜨고(기록관리처럼 특정 당사자 컨텍스트가 있을 때), 없으면
 * 생략한다(타임라인처럼 여러 당사자를 오갈 수 있는 화면 등에서).
 */
export function RecordDetailPane({
  recordId,
  personId,
  getEditHref,
}: {
  recordId: string | null;
  personId?: string;
  /**
   * 기본 "✎ 수정" 링크(`/persons/{personId}/records/{id}/edit`, 보호자 전용 경로)가
   * 안 맞는 화면(예: 활동지원사 일지 목록 — 2026-07-21)에서 편집 링크를 직접 계산한다.
   * null을 반환하면 그 기록에는 편집 버튼을 아예 숨긴다(예: 이미 제출된 일지).
   */
  getEditHref?: (detail: RecordDetail) => string | null;
}) {
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) {
      setDetail(null);
      return;
    }
    let active = true;
    setLoading(true);
    setConfirmError(null);
    getRecordDetail(recordId).then((res) => {
      if (active) {
        setDetail(res);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [recordId]);

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

  if (loading) return <p className="text-body text-muted-foreground">불러오는 중...</p>;
  if (!detail) return <p className="text-body text-muted-foreground">기록을 선택해주세요.</p>;

  const editHref = getEditHref
    ? getEditHref(detail)
    : personId
      ? `/persons/${personId}/records/${detail.id}/edit`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <DomainChip domain={detail.domain} />
          <h2 className="text-headline-2 font-bold text-foreground">{detail.title}</h2>
        </div>
        {editHref && (
          <Button render={<Link href={editHref} />} variant="outline" className="h-9">
            ✎ {detail.isDraft ? "이어서 작성" : "수정"}
          </Button>
        )}
      </div>
      <p className="text-caption text-muted-foreground">
        👤 작성자 {detail.authorName ?? "알 수 없음"} · 🗓 {detail.recordDate.slice(0, 10)}
      </p>

      {detail.requiresConfirmation && !detail.confirmedAt && (
        <div className="rounded-(--br-md) bg-domain-dai-bg p-4 ring-1 ring-domain-dai-accent/30">
          <p className="text-body text-foreground">
            🔑 이 기록은 공식 문서로 <b>확인</b>이 필요합니다. 승인·반려가 아니라 내용을 확인했음을
            남기는 절차입니다.
          </p>
          {confirmError && (
            <p role="alert" className="mt-2 text-caption font-semibold text-red-600">
              {confirmError}
            </p>
          )}
          <ConfirmCTA onConfirm={handleConfirm} busy={confirmBusy} className="mt-3 h-10 font-bold" />
        </div>
      )}
      {detail.requiresConfirmation && detail.confirmedAt && <ConfirmBadge confirmedAt={detail.confirmedAt} />}

      {detail.isGuardianRecord ? (
        <GuardianBody content={detail.content} />
      ) : (
        <StructuredBody recordType={detail.recordType} content={detail.content} guardianNote={detail.guardianNote} />
      )}
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
