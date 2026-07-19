"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseConferenceNoteInput } from "@ongil/validation";
import {
  createCaseConferenceNote,
  type CaseNoteClient,
} from "@/app/(app)/records/case-notes/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";

/**
 * W-23 사례회의록(WEL-006) 작성 — 단일 폼(AdvocacyConsultationForm.tsx와 동일 구조).
 * 대상 당사자 → 회의 일시·참석자 → 논의 내용 → 결정사항(선택).
 * WEL-006은 일상 기록이라 requires_confirmation=false — 확인 절차 없이 바로 저장되며,
 * 위자드가 아니라 회의 중 빠르게 메모하듯 쓸 수 있는 단일 폼으로 설계했다(워크숍 안건2-3).
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function CaseConferenceForm({
  clients,
  initialPersonId,
}: {
  clients: CaseNoteClient[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [personId, setPersonId] = useState(
    initialPersonId && clients.some((c) => c.personId === initialPersonId)
      ? initialPersonId
      : clients[0]?.personId ?? ""
  );
  const [meetingDate, setMeetingDate] = useState(nowLocal());
  const [participantsText, setParticipantsText] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [decisions, setDecisions] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );

  async function save() {
    if (!personId) {
      setError("당사자를 선택해주세요.");
      return;
    }
    const participants = participantsText
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (participants.length === 0) {
      setError("참석자를 1명 이상 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: CaseConferenceNoteInput = {
      meetingDate,
      participants,
      discussion: discussion.trim(),
      ...(decisions.trim() ? { decisions: decisions.trim() } : {}),
    };
    const res = await createCaseConferenceNote(personId, input);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(`/records/case-notes?personId=${personId}`);
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">사례회의록 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 당사자가 없어 사례회의록을 작성할 수 없습니다. 보호자가 복지서비스(WEL) 도메인
          작성 권한을 부여하면 해당 당사자의 사례회의록을 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        사례회의록 작성{" "}
        <span className="text-body font-medium text-muted-foreground">WEL-006</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        ISP 수립·재사정 논의 내용과 결정사항을 기록합니다. 확인 절차 없이 바로 저장됩니다.
        {client && <StageBadge lifeStage={client.lifeStage} className="min-h-6 pr-2 text-[11px]" />}
      </p>

      <div className="mt-6 flex flex-col gap-4 rounded-xl bg-white p-5 ring-1 ring-foreground/10">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="대상 당사자" required>
            <select
              className={fieldClass}
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.personId} value={c.personId}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="회의 일시" required>
            <input
              type="datetime-local"
              className={fieldClass}
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="참석자 (쉼표로 구분)" required>
          <input
            className={fieldClass}
            value={participantsText}
            onChange={(e) => setParticipantsText(e.target.value)}
            placeholder="예: 김사회복지사, 이보호자, 박특수교사"
          />
        </Field>

        <Field label="논의 내용" required>
          <textarea
            className={`${fieldClass} min-h-32`}
            value={discussion}
            onChange={(e) => setDiscussion(e.target.value)}
            maxLength={3000}
            placeholder="회의에서 논의한 내용을 기록하세요."
          />
        </Field>

        <Field label="결정사항 (선택)">
          <textarea
            className={`${fieldClass} min-h-24`}
            value={decisions}
            onChange={(e) => setDecisions(e.target.value)}
            maxLength={2000}
            placeholder="회의에서 결정된 사항을 기록하세요."
          />
        </Field>

        {error && (
          <p role="alert" className="text-body font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => router.push("/records/case-notes")}
          >
            취소
          </Button>
          <Button
            type="button"
            className="h-11 bg-domain-wel-accent font-bold text-white"
            disabled={busy}
            onClick={save}
          >
            {busy ? "저장 중..." : "사례회의록 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label font-semibold text-accent-stone">
        {label} {required && <span className="text-domain-med-text">*</span>}
      </span>
      {children}
    </label>
  );
}
