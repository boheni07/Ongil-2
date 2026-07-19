"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AccessLevel, DomainKey, InviteRole, Role } from "@ongil/validation";
import {
  findGranteeByEmail,
  getPermissionPresets,
  grantPermission,
  type GranteeSummary,
} from "@/app/(app)/persons/[id]/permissions/actions";
import { DateField } from "@/components/form/DateField";
import { DomainChip } from "@/components/timeline/DomainChip";
import { Button } from "@/components/ui/button";

/**
 * G-32 권한 부여 — 대상자·도메인·수준·기간을 한 화면에서 입력한다(2026-07-19,
 * 기존 4단계 위저드를 병합해 대체 — 회원가입·당사자등록 폼과 동일한 방향).
 * 대상자 조회 결과(역할)로 도메인 프리셋을 정하는 비동기 의존만 남아 있어, 이건
 * "다음" 버튼 대신 조회 완료 시점에 자동으로 프리셋을 불러오는 방식(useEffect)으로
 * 대체했다 — 나머지는 전부 화면에 항상 보이는 섹션이라 순서를 강제할 이유가 없다.
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

  // 대상자
  const [email, setEmail] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [grantee, setGrantee] = useState<GranteeSummary | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [inviteRole, setInviteRole] = useState<InviteRole | "">("");

  // 도메인·수준
  const [selected, setSelected] = useState<DomainKey[]>([]);
  const [levelByDomain, setLevelByDomain] = useState<Partial<Record<DomainKey, AccessLevel>>>({});
  const [presetsLoaded, setPresetsLoaded] = useState(false);

  // 유효기간
  const [unlimited, setUnlimited] = useState(false);
  const [validUntil, setValidUntil] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [done, setDone] = useState<{ invited: boolean } | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const orderedSelected = DOMAINS.filter((d) => selected.includes(d.key)).map((d) => d.key);
  const hasEdit = orderedSelected.some((d) => levelByDomain[d] === "edit");
  const targetValid = (mode === "existing" && !!grantee) || (mode === "invite" && emailValid && inviteRole !== "");

  function resetLookup() {
    setLookupDone(false);
    setMode(null);
    setGrantee(null);
    setInviteRole("");
    setPresetsLoaded(false);
    setSelected([]);
    setLevelByDomain({});
  }

  async function runLookup() {
    if (!emailValid || lookupBusy) return;
    setLookupBusy(true);
    setError(null);
    setPresetsLoaded(false);
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

  // 대상자의 역할이 확정되는 즉시(기존 협력자 조회 성공, 또는 초대 역할 선택) 도메인
  // 프리셋을 자동으로 불러온다 — 이전엔 "다음" 버튼을 눌러야만 진행됐다.
  useEffect(() => {
    if (!targetValid || presetsLoaded) return;
    const role: Role = mode === "existing" ? grantee!.role : (inviteRole as InviteRole);
    let cancelled = false;
    void getPermissionPresets(role).then((presets) => {
      if (cancelled) return;
      const presetMap: Partial<Record<DomainKey, AccessLevel>> = {};
      for (const p of presets) presetMap[p.domain] = p.accessLevel;
      setSelected(presets.map((p) => p.domain));
      setLevelByDomain(presetMap);
      setPresetsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grantee/inviteRole 변화는 targetValid로 이미 반영됨
  }, [targetValid, presetsLoaded]);

  function toggleDomain(d: DomainKey) {
    setSelected((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      return [...prev, d];
    });
    setLevelByDomain((prev) => {
      if (prev[d]) return prev;
      return { ...prev, [d]: "read" };
    });
  }

  function setLevel(d: DomainKey, lvl: AccessLevel) {
    setLevelByDomain((prev) => ({ ...prev, [d]: lvl }));
  }

  const domainsValid = orderedSelected.length >= 1;
  const periodValid = hasEdit ? Boolean(validUntil) : unlimited || Boolean(validUntil);
  const canSubmit = targetValid && domainsValid && periodValid;

  async function submit() {
    if (!canSubmit) {
      setError("대상자·도메인·유효 기간을 모두 입력해주세요.");
      return;
    }
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
    <div className="mx-auto flex min-h-full max-w-2xl flex-1 flex-col">
      <h1 className="text-headline-1 font-extrabold text-foreground">권한 부여</h1>
      <p className="mt-1 text-body text-muted-foreground">{personName}에 대한 접근 권한을 부여합니다.</p>

      <div className="mt-6 flex flex-col gap-8">
        <section className="flex flex-col gap-4">
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
                      onClick={() => {
                        setInviteRole(inviteRole === r.value ? "" : r.value);
                        setPresetsLoaded(false);
                      }}
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
        </section>

        <section className={`flex flex-col gap-4 ${targetValid ? "" : "opacity-50"}`}>
          <h2 className="text-headline-3 font-bold text-accent-stone">
            어떤 도메인에 접근하나요? <span className="text-body font-normal text-muted-foreground">(복수 선택)</span>
          </h2>
          {!targetValid ? (
            <p className="text-caption text-muted-foreground">먼저 대상자를 확정해주세요.</p>
          ) : !presetsLoaded ? (
            <p className="text-caption text-muted-foreground">프리셋을 불러오는 중...</p>
          ) : (
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
                disabled={!targetValid}
                onClick={() => toggleDomain(d.key)}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-(--br-md) border-2 px-3 transition-colors disabled:cursor-not-allowed ${
                  selected.includes(d.key)
                    ? "border-primary-600 bg-primary-50"
                    : "border-border hover:border-primary-400"
                }`}
              >
                <DomainChip domain={d.key} />
              </button>
            ))}
          </div>
        </section>

        <section className={`flex flex-col gap-5 ${domainsValid ? "" : "opacity-50"}`}>
          <h2 className="text-headline-3 font-bold text-accent-stone">권한 수준과 유효 기간</h2>

          {domainsValid ? (
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
          ) : (
            <p className="text-caption text-muted-foreground">먼저 도메인을 선택해주세요.</p>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-label font-semibold text-accent-stone">유효 기간 (종료일)</span>
            <div className="flex flex-wrap items-center gap-3">
              <DateField
                className={`${fieldClass} w-auto`}
                value={validUntil}
                disabled={(unlimited && !hasEdit) || !domainsValid}
                onChange={setValidUntil}
              />
              <label className="inline-flex items-center gap-1.5 text-body">
                <input
                  type="checkbox"
                  checked={unlimited && !hasEdit}
                  disabled={hasEdit || !domainsValid}
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
        </section>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-2 border-t border-border pt-6">
        <Button type="button" variant="outline" className="h-11" disabled={submitBusy} onClick={() => router.push(`/persons/${personId}/permissions`)}>
          취소
        </Button>
        <div className="flex-1" />
        <Button type="button" className="h-11 font-bold" disabled={submitBusy || !canSubmit} onClick={() => void submit()}>
          {submitBusy ? "부여 중..." : "권한 부여"}
        </Button>
      </div>
    </div>
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
