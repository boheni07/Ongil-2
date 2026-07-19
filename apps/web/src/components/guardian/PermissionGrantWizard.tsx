"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccessLevel, DomainKey, InviteRole, Role } from "@ongil/validation";
import {
  findGranteeByEmail,
  getPermissionPresets,
  grantPermission,
  type GranteeSummary,
} from "@/app/(app)/persons/[id]/permissions/actions";
import { WizardProgress } from "@/components/form/WizardProgress";
import { DateField } from "@/components/form/DateField";
import { DomainChip } from "@/components/timeline/DomainChip";
import { Button } from "@/components/ui/button";

/**
 * G-32 권한 부여 4단계 위저드(대상자 → 도메인 → 수준·기간 → 확인).
 * 프로토타입 web-guardian.html 601~674줄을 확장: Step3은 프로토타입의 flat 단일 라디오 대신
 * "선택된 도메인마다 개별 수준 행"으로 렌더한다(도메인별 프리셋 access_level이 다르기 때문).
 * 유효기간은 전체 공통 1개(종료일 + 무기한)로 두되, edit가 하나라도 있으면 무기한을 막고 종료일을 강제한다.
 */

const DOMAINS: { key: DomainKey; label: string }[] = [
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

const LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "read", label: "읽기 (read)" },
  { value: "write", label: "작성 (write)" },
  { value: "edit", label: "편집 (edit)" },
];

const INVITE_ROLES: { value: InviteRole; label: string }[] = [
  { value: "supporter", label: "활동지원사" },
  { value: "teacher", label: "특수교사" },
  { value: "social_worker", label: "사회복지사" },
  { value: "therapist", label: "치료사" },
];

const ROLE_LABEL: Record<Role, string> = {
  guardian: "보호자",
  person: "당사자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

const STEP_LABELS = ["대상자", "도메인", "수준·기간", "확인"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600";

type Mode = "existing" | "invite";

export function PermissionGrantWizard({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step1 — 대상자
  const [email, setEmail] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [grantee, setGrantee] = useState<GranteeSummary | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [inviteRole, setInviteRole] = useState<InviteRole | "">("");

  // Step2/3 — 도메인·수준
  const [selected, setSelected] = useState<DomainKey[]>([]);
  const [levelByDomain, setLevelByDomain] = useState<Partial<Record<DomainKey, AccessLevel>>>({});
  const [presetByDomain, setPresetByDomain] = useState<Partial<Record<DomainKey, AccessLevel>>>({});

  // Step3 — 유효기간
  const [unlimited, setUnlimited] = useState(false);
  const [validUntil, setValidUntil] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [done, setDone] = useState<{ invited: boolean } | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const orderedSelected = DOMAINS.filter((d) => selected.includes(d.key)).map((d) => d.key);
  const hasEdit = orderedSelected.some((d) => levelByDomain[d] === "edit");

  function resetLookup() {
    setLookupDone(false);
    setMode(null);
    setGrantee(null);
    setInviteRole("");
  }

  async function runLookup() {
    if (!emailValid || lookupBusy) return;
    setLookupBusy(true);
    setError(null);
    const found = await findGranteeByEmail(email);
    if (found) {
      setGrantee(found);
      setMode("existing");
    } else {
      setGrantee(null);
      setMode("invite");
    }
    setLookupDone(true);
    setLookupBusy(false);
  }

  const step1Valid =
    (mode === "existing" && !!grantee) || (mode === "invite" && emailValid && inviteRole !== "");

  async function proceedFromStep1() {
    if (!step1Valid) return;
    const role: Role = mode === "existing" ? grantee!.role : (inviteRole as InviteRole);
    const presets = await getPermissionPresets(role);

    const presetMap: Partial<Record<DomainKey, AccessLevel>> = {};
    for (const p of presets) presetMap[p.domain] = p.accessLevel;

    setPresetByDomain(presetMap);
    setSelected(presets.map((p) => p.domain));
    setLevelByDomain({ ...presetMap });
    setStep(2);
  }

  function toggleDomain(d: DomainKey) {
    setSelected((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      return [...prev, d];
    });
    setLevelByDomain((prev) => {
      if (prev[d]) return prev;
      return { ...prev, [d]: presetByDomain[d] ?? "read" };
    });
  }

  function setLevel(d: DomainKey, lvl: AccessLevel) {
    setLevelByDomain((prev) => ({ ...prev, [d]: lvl }));
  }

  const step2Valid = orderedSelected.length >= 1;
  const step3Valid = hasEdit ? Boolean(validUntil) : unlimited || Boolean(validUntil);

  async function submit() {
    setSubmitBusy(true);
    setError(null);

    const domains = orderedSelected.map((d) => ({
      domain: d,
      accessLevel: levelByDomain[d] ?? "read",
    }));
    const vUntil = unlimited && !hasEdit ? null : validUntil || null;

    const input =
      mode === "invite"
        ? ({
            target: "invite" as const,
            inviteEmail: email.trim().toLowerCase(),
            inviteRole: inviteRole as InviteRole,
            domains,
            validUntil: vUntil,
          })
        : ({
            target: "existing" as const,
            granteeUserId: grantee!.id,
            domains,
            validUntil: vUntil,
          });

    const res = await grantPermission(personId, input);
    if (res.error) {
      setError(res.error);
      setSubmitBusy(false);
      return;
    }
    setDone({ invited: Boolean(res.invited) });
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-full max-w-xl flex-1 flex-col items-center justify-center py-12 text-center">
        <p className="text-5xl" aria-hidden="true">
          ✅
        </p>
        <h1 className="mt-4 text-headline-2 font-extrabold text-foreground">
          {done.invited ? "초대 이메일이 발송되었습니다" : "권한이 부여되었습니다"}
        </h1>
        <p className="mt-2 text-body text-muted-foreground">
          {done.invited
            ? `${email.trim()} 님이 초대를 수락하면 권한이 부여됩니다.`
            : `${grantee?.fullName ?? "대상자"} 님에게 권한이 부여되었으며, 대상자에게 알림이 전송됩니다.`}
        </p>
        <Button
          render={<Link href={`/persons/${personId}/permissions`} />}
          className="mt-6 h-11 font-bold"
        >
          권한 목록으로
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-1 flex-col">
      <h1 className="text-headline-1 font-extrabold text-foreground">권한 부여</h1>
      <p className="mt-1 text-body text-muted-foreground">
        {personName}에 대한 접근 권한을 4단계로 부여합니다.
      </p>

      <Stepper current={step} className="mt-5 mb-2" />
      <WizardProgress current={step} total={4} label={STEP_LABELS[step - 1]} className="mb-6" />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-headline-3 font-bold text-accent-stone">누구에게 권한을 부여하나요?</h2>
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-semibold text-accent-stone">대상자 이메일</span>
            <div className="flex gap-2">
              <input
                type="email"
                inputMode="email"
                className={fieldClass}
                value={email}
                placeholder="name@example.com"
                onChange={(e) => {
                  setEmail(e.target.value);
                  resetLookup();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runLookup();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                disabled={!emailValid || lookupBusy}
                onClick={() => void runLookup()}
              >
                {lookupBusy ? "조회 중..." : "조회"}
              </Button>
            </div>
          </label>

          {lookupDone && mode === "existing" && grantee && (
            <div className="rounded-(--br-md) border-2 border-primary-600 bg-primary-50 p-4">
              <p className="text-body font-bold text-primary-800">{grantee.fullName}</p>
              <p className="text-caption text-accent-stone">
                {ROLE_LABEL[grantee.role] ?? grantee.role} · 기존 협력자
              </p>
            </div>
          )}

          {lookupDone && mode === "invite" && (
            <div className="flex flex-col gap-3 rounded-(--br-md) border border-border bg-white p-4">
              <p className="text-body text-foreground">
                가입되지 않은 이메일입니다. 초대 링크로 새 이해관계자를 추가할 수 있습니다.
              </p>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-label font-semibold text-accent-stone">초대할 역할</legend>
                <div className="grid grid-cols-2 gap-2">
                  {INVITE_ROLES.map((r) => (
                    <Chip
                      key={r.value}
                      on={inviteRole === r.value}
                      onClick={() => setInviteRole(inviteRole === r.value ? "" : r.value)}
                    >
                      {r.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {!lookupDone && (
            <p className="text-caption text-muted-foreground">
              이메일을 조회해 기존 협력자를 찾거나, 없으면 초대 링크로 새 이해관계자를 추가할 수 있습니다.
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-headline-3 font-bold text-accent-stone">
            어떤 도메인에 접근하나요? <span className="text-body font-normal text-muted-foreground">(복수 선택)</span>
          </h2>
          {presetByDomain && Object.keys(presetByDomain).length > 0 && (
            <p className="text-caption text-muted-foreground">
              역할 기본 프리셋에 따라 일부 도메인이 자동 선택되었습니다. 필요에 맞게 조정하세요.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DOMAINS.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={selected.includes(d.key)}
                onClick={() => toggleDomain(d.key)}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-(--br-md) border-2 px-3 transition-colors ${
                  selected.includes(d.key)
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

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <h2 className="text-headline-3 font-bold text-accent-stone">권한 수준과 유효 기간</h2>

          <div className="flex flex-col gap-3">
            <span className="text-label font-semibold text-accent-stone">도메인별 권한 수준</span>
            {orderedSelected.map((d) => {
              const label = DOMAINS.find((x) => x.key === d)!.label;
              return (
                <div
                  key={d}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-(--br-md) border border-border bg-white p-3"
                >
                  <div className="flex w-20 items-center gap-2">
                    <DomainChip domain={d} />
                  </div>
                  <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
                    <legend className="sr-only">{label} 권한 수준</legend>
                    {LEVELS.map((lvl) => (
                      <label key={lvl.value} className="inline-flex items-center gap-1.5 text-body">
                        <input
                          type="radio"
                          name={`lvl-${d}`}
                          value={lvl.value}
                          checked={(levelByDomain[d] ?? "read") === lvl.value}
                          onChange={() => setLevel(d, lvl.value)}
                          className="size-4 accent-primary-600"
                        />
                        {lvl.label}
                      </label>
                    ))}
                  </fieldset>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label font-semibold text-accent-stone">유효 기간 (종료일)</span>
            <div className="flex flex-wrap items-center gap-3">
              <DateField
                className={`${fieldClass} w-auto`}
                value={validUntil}
                disabled={unlimited && !hasEdit}
                onChange={setValidUntil}
              />
              <label className="inline-flex items-center gap-1.5 text-body">
                <input
                  type="checkbox"
                  checked={unlimited && !hasEdit}
                  disabled={hasEdit}
                  onChange={(e) => {
                    setUnlimited(e.target.checked);
                    if (e.target.checked) setValidUntil("");
                  }}
                  className="size-4 accent-primary-600"
                />
                무기한
              </label>
            </div>
            {hasEdit && (
              <p className="text-caption font-semibold text-domain-dai-text">
                편집(edit) 권한은 무기한으로 부여할 수 없습니다. 종료일을 지정해주세요.
              </p>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-headline-3 font-bold text-accent-stone">부여 내용 확인</h2>
          <ul className="flex flex-col gap-2 rounded-(--br-md) bg-white p-5 ring-1 ring-foreground/10">
            <SummaryRow label="당사자">
              <b className="text-foreground">{personName}</b>
            </SummaryRow>
            <SummaryRow label="대상자">
              <b className="text-foreground">
                {mode === "existing"
                  ? `${grantee?.fullName} (${ROLE_LABEL[grantee!.role] ?? grantee!.role})`
                  : `${email.trim()} · 초대 (${
                      INVITE_ROLES.find((r) => r.value === inviteRole)?.label ?? inviteRole
                    })`}
              </b>
            </SummaryRow>
            <SummaryRow label="도메인·수준">
              <div className="flex flex-col items-end gap-1">
                {orderedSelected.map((d) => (
                  <span key={d} className="inline-flex items-center gap-2">
                    <DomainChip domain={d} />
                    <b className="text-foreground">
                      {LEVELS.find((l) => l.value === (levelByDomain[d] ?? "read"))?.label}
                    </b>
                  </span>
                ))}
              </div>
            </SummaryRow>
            <SummaryRow label="유효 기간">
              <b className="text-foreground">
                {unlimited && !hasEdit ? "무기한" : validUntil ? `~ ${validUntil}` : "-"}
              </b>
            </SummaryRow>
          </ul>
          <p className="text-caption text-muted-foreground">
            부여 시 대상자에게 알림이 전송되며, 모든 접근은 접근 로그(G-40)에 기록됩니다.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-8">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={submitBusy}
          render={step === 1 ? <Link href={`/persons/${personId}/permissions`} /> : undefined}
          onClick={step === 1 ? undefined : () => setStep((s) => s - 1)}
        >
          ← {step === 1 ? "취소" : "이전"}
        </Button>
        <div className="flex-1" />
        {step < 4 ? (
          <Button
            type="button"
            className="h-11"
            disabled={
              (step === 1 && !step1Valid) ||
              (step === 2 && !step2Valid) ||
              (step === 3 && !step3Valid)
            }
            onClick={() => {
              if (step === 1) void proceedFromStep1();
              else setStep((s) => s + 1);
            }}
          >
            다음 →
          </Button>
        ) : (
          <Button type="button" className="h-11 font-bold" disabled={submitBusy} onClick={() => void submit()}>
            {submitBusy ? "부여 중..." : "권한 부여"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ current, className }: { current: number; className?: string }) {
  return (
    <ol className={`flex items-center gap-2 ${className ?? ""}`}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const doneStep = n < current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={`flex size-6 items-center justify-center rounded-full text-caption font-bold ${
                active || doneStep ? "bg-primary-600 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {n}
            </span>
            <span
              className={`text-caption font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </span>
            {n < STEP_LABELS.length && <span aria-hidden="true" className="mx-1 h-px w-4 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-4 text-body">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </li>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-(--br-md) border-2 px-4 text-body font-semibold transition-colors ${
        on ? "border-primary-600 bg-primary-50 text-primary-800" : "border-border text-accent-stone hover:border-primary-400"
      }`}
    >
      {children}
    </button>
  );
}
