"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DomainKey } from "@ongil/validation";
import {
  createGuardianRecord,
  updateGuardianRecord,
  type RecordDetail,
} from "@/app/(app)/persons/[id]/records/actions";
import { DomainChip } from "@/components/timeline/DomainChip";
import { RecordContentView } from "@/components/records/RecordContentView";
import { Button } from "@/components/ui/button";

/**
 * G-21 기록 작성·수정. 신규(existing=null)와 수정(existing 있음) 겸용.
 * 수정 시 existing.isGuardianRecord가 false(구조화 기록)면 원본은 읽기 전용으로 보여주고
 * "보호자 메모"만 편집한다 — content를 통째로 덮어써 원본 필드를 잃지 않기 위해서다.
 * 프로토타입 web-guardian.html 526~566줄.
 */

const DOMAINS: { key: DomainKey; label: string }[] = [
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600";

export function RecordForm({
  personId,
  personName,
  existing,
}: {
  personId: string;
  personName: string;
  existing: RecordDetail | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(existing);
  const isStructuredEdit = isEdit && existing ? !existing.isGuardianRecord : false;

  const [domain, setDomain] = useState<DomainKey>(existing?.domain ?? "WEL");
  const initialTitle = existing
    ? existing.isGuardianRecord
      ? existing.title
      : (existing.guardianNote?.title ?? "")
    : "";
  const initialBody = existing
    ? existing.isGuardianRecord
      ? ((existing.content as { body?: string } | null)?.body ?? "")
      : (existing.guardianNote?.body ?? "")
    : "";
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = title.trim().length > 0 && body.trim().length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);

    const input = { domain, title: title.trim(), body: body.trim() };
    const res =
      isEdit && existing
        ? await updateGuardianRecord(existing.id, input)
        : await createGuardianRecord(personId, input);

    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push(`/persons/${personId}/records`);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col">
      <h1 className="text-headline-1 font-extrabold text-foreground">
        {isEdit ? "기록 수정" : "새 기록 작성"}
      </h1>
      <p className="mt-1 text-body text-muted-foreground">{personName}</p>

      <div className="mt-5 rounded-(--br-md) bg-primary-50 p-4 text-body text-primary-800">
        🔑 보호자는 <b>guardians</b> 관계로 도메인 제한 없이 모든 기록을 직접 작성·수정할 수
        있습니다(권한 매트릭스의 read/write/edit 부여와 무관).
      </div>

      {isStructuredEdit && existing && (
        <div className="mt-4 rounded-(--br-md) border border-border p-4">
          <p className="mb-2 text-label font-semibold text-accent-stone">
            원본 기록 내용(읽기 전용 · {existing.authorName ?? "전문가"} 작성)
          </p>
          <RecordContentView
            content={(() => {
              const rest = { ...((existing.content as Record<string, unknown>) ?? {}) };
              delete rest.guardianNote;
              return rest;
            })()}
          />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {!isStructuredEdit && (
          <div>
            <span id="domain-label" className="text-label font-semibold text-accent-stone">
              도메인 선택
            </span>
            <div
              role="radiogroup"
              aria-labelledby="domain-label"
              className="mt-2 grid grid-cols-3 gap-2"
            >
              {DOMAINS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  role="radio"
                  aria-checked={domain === d.key}
                  disabled={isEdit}
                  onClick={() => setDomain(d.key)}
                  className={`flex min-h-11 items-center justify-center rounded-(--br-md) border-2 px-3 transition-colors disabled:opacity-60 ${
                    domain === d.key
                      ? "border-primary-600 bg-primary-50"
                      : "border-border hover:border-primary-400"
                  }`}
                >
                  <DomainChip domain={d.key} />
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-accent-stone">
            {isStructuredEdit ? "보호자 메모 제목" : "제목"}
          </span>
          <input
            type="text"
            className={fieldClass}
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-label font-semibold text-accent-stone">
            {isStructuredEdit ? "보호자 메모 내용" : "내용"}
          </span>
          <textarea
            className={`${fieldClass} min-h-32 py-2`}
            value={body}
            maxLength={5000}
            placeholder="기록 내용을 입력하세요"
            onChange={(e) => setBody(e.target.value)}
          />
        </label>

        <div>
          <span className="text-label font-semibold text-accent-stone">첨부파일</span>
          <div className="mt-2">
            <Button type="button" variant="outline" disabled className="h-10">
              📎 파일 첨부 (준비 중)
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={busy}
          onClick={() => router.push(`/persons/${personId}/records`)}
        >
          취소
        </Button>
        <div className="flex-1" />
        <Button type="button" className="h-11 font-bold" disabled={!valid || busy} onClick={() => void submit()}>
          {busy ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}
