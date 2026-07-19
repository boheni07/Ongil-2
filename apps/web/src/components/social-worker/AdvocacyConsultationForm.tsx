"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdvocacyConsultationInput, AdvocacyIssueType } from "@ongil/validation";
import {
  createAdvocacyConsultation,
  type LegClient,
} from "@/app/(app)/records/leg/actions";
import { StageBadge } from "@/components/lifecycle/StageBadge";
import { Button } from "@/components/ui/button";
import { isSelfConfirmingStage } from "@/lib/lifecycle";

/**
 * W-19 권익옹호 상담기록(LEG-002) 작성 — 단일 페이지 폼(ObservationForm.tsx와 동일 구조).
 * 대상 당사자 → 상담 일시·유형 → 상담 내용 → 취한 조치·연계 기관(선택).
 * LEG-002는 일상 기록이라 requires_confirmation=false(§4-6, 관찰기록과 동급) — 확인 절차 없음.
 * consultedAt이 record_date로도 쓰인다(서버 actions.ts에서 파싱).
 */

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 py-2 text-body text-foreground outline-none focus-visible:border-primary-600";

const ISSUE_TYPE_LABEL: Record<AdvocacyIssueType, string> = {
  rights_violation: "인권침해",
  discrimination: "차별",
  abuse_suspected: "학대의심",
  other: "기타",
};

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function AdvocacyConsultationForm({
  clients,
  initialPersonId,
}: {
  clients: LegClient[];
  initialPersonId?: string;
}) {
  const router = useRouter();
  const [personId, setPersonId] = useState(
    initialPersonId && clients.some((c) => c.personId === initialPersonId)
      ? initialPersonId
      : clients[0]?.personId ?? ""
  );
  const [consultedAt, setConsultedAt] = useState(nowLocal());
  const [issueType, setIssueType] = useState<AdvocacyIssueType>("rights_violation");
  const [content, setContent] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [referralAgency, setReferralAgency] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );
  const blocked = client ? !isSelfConfirmingStage(client.lifeStage) : false;

  async function save() {
    if (!personId) {
      setError("당사자를 선택해주세요.");
      return;
    }
    if (blocked) {
      setError("권익옹호 상담기록은 성인기(만 19세) 이상 당사자에게만 작성할 수 있습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: AdvocacyConsultationInput = {
      consultedAt,
      issueType,
      content: content.trim(),
      ...(actionTaken.trim() ? { actionTaken: actionTaken.trim() } : {}),
      ...(referralAgency.trim() ? { referralAgency: referralAgency.trim() } : {}),
    };
    const res = await createAdvocacyConsultation(personId, input);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(`/records/leg?personId=${personId}`);
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 ring-1 ring-foreground/10">
        <h1 className="text-headline-2 font-bold text-foreground">권익옹호 상담기록 작성</h1>
        <p className="mt-3 text-body text-muted-foreground">
          담당 당사자가 없어 권익옹호 상담기록을 작성할 수 없습니다. 보호자가 법률·권리(LEG) 도메인
          작성 권한을 부여하면 해당 당사자의 상담기록을 작성할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-1 flex-col">
      <h1 className="text-headline-2 font-extrabold text-foreground">
        권익옹호 상담기록 작성{" "}
        <span className="text-body font-medium text-muted-foreground">LEG-002</span>
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-body text-muted-foreground">
        인권침해·차별·학대의심 등 권익옹호 상담 내용을 기록합니다.
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
          <Field label="상담 일시" required>
            <input
              type="datetime-local"
              className={fieldClass}
              value={consultedAt}
              onChange={(e) => setConsultedAt(e.target.value)}
            />
          </Field>
        </div>

        {blocked && (
          <div className="rounded-(--br-md) bg-domain-med-bg p-4 text-body font-semibold text-domain-med-text">
            🔏 권익옹호 상담기록은 성인기(만 19세) 이상부터 작성할 수 있습니다. 이 당사자는 아직 성인기
            이전 단계라 대상이 아닙니다.
          </div>
        )}

        <Field label="상담 유형" required>
          <select
            className={fieldClass}
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as AdvocacyIssueType)}
          >
            {(["rights_violation", "discrimination", "abuse_suspected", "other"] as const).map(
              (t) => (
                <option key={t} value={t}>
                  {ISSUE_TYPE_LABEL[t]}
                </option>
              )
            )}
          </select>
        </Field>

        <Field label="상담 내용" required>
          <textarea
            className={`${fieldClass} min-h-32`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={3000}
            placeholder="상담 경위, 당사자 진술, 확인된 권익 침해 정황 등을 구체적으로 기록하세요."
          />
        </Field>

        <Field label="취한 조치 (선택)">
          <textarea
            className={`${fieldClass} min-h-24`}
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            maxLength={2000}
            placeholder="상담 후 취한 조치·안내·후속 계획 등을 기록하세요."
          />
        </Field>

        <Field label="연계 기관 (선택)">
          <input
            className={fieldClass}
            value={referralAgency}
            onChange={(e) => setReferralAgency(e.target.value)}
            placeholder="예: 장애인권익옹호기관, 국가인권위원회"
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
            onClick={() => router.push("/records/leg")}
          >
            취소
          </Button>
          <Button
            type="button"
            className="h-11 bg-domain-leg-accent font-bold text-white"
            disabled={busy || blocked}
            onClick={save}
          >
            {busy ? "저장 중..." : "상담기록 저장"}
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
