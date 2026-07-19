"use client";

import { useState } from "react";
import { confirmRecord, type RecordListItem } from "@/app/(app)/persons/[id]/records/actions";
import type { LifeStage } from "@/components/lifecycle/StageBadge";
import { DomainChip } from "@/components/timeline/DomainChip";
import { ConfirmBadge } from "@/components/records/ConfirmBadge";
import { ConfirmCTA } from "@/components/records/ConfirmCTA";
import { isSelfConfirmingStage } from "@/lib/lifecycle";

/**
 * P-10 기록 보기(당사자 본인) — docs/02-ia.md §3-10.
 * 본인 기록을 시간순으로 나열하고, 공식 문서에는 ConfirmBadge를 붙인다.
 * "이 기록을 봤어요" 확인 CTA는 성인기·노년기(만 19세 이상) 본인이 확인 주체(confirmerId===userId)인
 * 미확인 기록에만 노출한다 — 그 이전 단계(infant/child/youth_transition)는 확인 주체가 보호자이므로
 * 배지만 표시하고 이 화면에서는 액션이 없다. "승인/반려" 개념은 두지 않는다.
 */
export function PersonRecordsView({
  items,
  userId,
  lifeStage,
}: {
  items: RecordListItem[];
  userId: string;
  lifeStage: LifeStage;
}) {
  const [records, setRecords] = useState(items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null);

  // Wave M-2(docs/11-livinglab-mega-workshop.md) — ITP(EDU-005)는 RLS상 이미 본인이 볼 수
  // 있지만(person 셀프 분기는 domain/record_type 무관), 다른 EDU 기록들 사이에 묻혀 청소년
  // 전환기 당사자가 "학교가 내 진로를 준비하고 있다"는 사실 자체를 놓치기 쉽다는 리빙랩 관찰에
  // 따라 눈에 띄는 안내 배너를 추가한다(RLS/기능 변경 없음 — 순수 발견성 개선).
  const hasItp = lifeStage === "youth_transition" && records.some((r) => r.recordType === "EDU-005");

  async function handleConfirm(id: string) {
    setBusyId(id);
    setErrorId(null);
    const res = await confirmRecord(id);
    if (res.error) {
      setErrorId({ id, message: res.error });
      setBusyId(null);
      return;
    }
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, confirmedAt: new Date().toISOString() } : r))
    );
    setBusyId(null);
  }

  if (records.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-5 text-person-base text-accent-pebble ring-1 ring-foreground/10">
        아직 볼 수 있는 기록이 없어요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {hasItp && (
        <li className="flex items-center gap-3 rounded-2xl bg-domain-tra-bg p-5 ring-1 ring-domain-tra-accent/40">
          <span aria-hidden="true" className="text-3xl">
            🎓
          </span>
          <p className="text-person-base font-semibold text-domain-tra-text">
            학교에서 준비한 개별화전환계획(ITP)이 있어요. 아래 목록에서 확인해 보세요.
          </p>
        </li>
      )}
      {records.map((r) => {
        const isPending = r.requiresConfirmation && !r.confirmedAt;
        const canConfirm = isSelfConfirmingStage(lifeStage) && r.confirmerId === userId && isPending;
        return (
          <li
            key={r.id}
            className="flex flex-col gap-2 rounded-2xl bg-white p-5 ring-1 ring-foreground/10"
          >
            <div className="flex flex-wrap items-center gap-2">
              <DomainChip domain={r.domain} />
              <span className="text-person-base font-bold text-foreground">{r.title}</span>
              {r.requiresConfirmation && (
                <ConfirmBadge confirmedAt={r.confirmedAt} />
              )}
            </div>
            <p className="text-sm text-accent-pebble">
              {r.authorName ?? "알 수 없음"} · {r.recordDate.slice(0, 10)}
            </p>
            {canConfirm && (
              <div className="mt-1">
                <ConfirmCTA
                  onConfirm={() => handleConfirm(r.id)}
                  busy={busyId === r.id}
                  label="이 기록을 봤어요"
                  className="h-12 px-6 text-person-base font-bold"
                />
                {errorId?.id === r.id && (
                  <p role="alert" className="mt-2 text-sm font-semibold text-red-600">
                    {errorId.message}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
