"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { completeOAuthSignup, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { authButtonClass } from "./AuthShell";
import { cn } from "@/lib/utils";

type RoleOption = { value: string; emoji: string; label: string; desc: string };

const ROLE_OPTIONS: RoleOption[] = [
  { value: "person", emoji: "🙋", label: "당사자", desc: "내 삶을 내가 기록" },
  { value: "guardian", emoji: "👪", label: "보호자", desc: "가족을 대신해 관리" },
  { value: "supporter", emoji: "🤝", label: "활동지원사", desc: "현장 활동 기록" },
  { value: "teacher", emoji: "🏫", label: "특수교사", desc: "IEP·관찰 기록" },
  { value: "social_worker", emoji: "🧑‍💼", label: "사회복지사", desc: "ISP·전환 지원" },
  { value: "therapist", emoji: "🩺", label: "치료사", desc: "치료계획·회기" },
];

type ConsentKey = "ageOver14" | "termsAgreed" | "privacyAgreed" | "sensitiveAgreed" | "marketingAgreed";
const REQUIRED_CONSENTS: ConsentKey[] = ["ageOver14", "termsAgreed", "privacyAgreed", "sensitiveAgreed"];

type ConsentItem = { key: ConsentKey; required: boolean; label: string; viewHref?: string };

const CONSENT_ITEMS: ConsentItem[] = [
  { key: "ageOver14", required: true, label: "만 14세 이상입니다" },
  { key: "termsAgreed", required: true, label: "이용약관 동의", viewHref: "/legal/terms" },
  { key: "privacyAgreed", required: true, label: "개인정보 수집·이용 동의", viewHref: "/legal/privacy" },
  { key: "sensitiveAgreed", required: true, label: "민감정보(건강·장애) 처리 동의", viewHref: "/legal/privacy" },
  { key: "marketingAgreed", required: false, label: "마케팅·이벤트 정보 수신" },
];

/**
 * A-03(역할 선택)+A-08(동의) 통합 — 소셜(카카오/네이버) 신규 가입자 전용. 프로필 필드
 * (이름/이메일/비밀번호/휴대폰)는 이미 provider 인증으로 충족돼 여기서 다시 받지 않는다
 * (docs/01-prd.md §5-1-1 "OAuth 신규 사용자는 A-04·A-05를 건너뛴다").
 */
export function OAuthCompleteForm({ invite }: { invite: string | null }) {
  const [state, formAction, pending] = useActionState<AuthActionState | undefined, FormData>(
    completeOAuthSignup,
    undefined
  );
  const [role, setRole] = useState("");
  const [checked, setChecked] = useState<Record<ConsentKey, boolean>>({
    ageOver14: false,
    termsAgreed: false,
    privacyAgreed: false,
    sensitiveAgreed: false,
    marketingAgreed: false,
  });
  const allId = useId();

  const requiredMet = REQUIRED_CONSENTS.every((k) => checked[k]);
  const canSubmit = Boolean(role) && requiredMet;

  function toggle(key: ConsentKey, value: boolean) {
    setChecked((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-6">
      <input type="hidden" name="role" value={role} />
      {invite && <input type="hidden" name="invite" value={invite} />}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-bold text-foreground">어떤 역할로 시작하시나요?</legend>
        <div role="radiogroup" aria-label="역할 선택" className="grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map((r) => {
            const active = role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setRole(r.value)}
                className={cn(
                  "relative flex min-h-[100px] flex-col items-start gap-1 rounded-[14px] border-2 p-4 text-left transition-colors",
                  active ? "border-primary-600 bg-primary-50" : "border-border bg-background hover:border-primary-400"
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white"
                  >
                    ✓
                  </span>
                )}
                <span aria-hidden="true" className="text-2xl">
                  {r.emoji}
                </span>
                <span className="text-[15px] font-bold text-foreground">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.desc}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-bold text-foreground">약관 및 개인정보 동의</legend>
        <label
          htmlFor={allId}
          className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[10px] bg-primary-50 px-4 font-bold text-foreground"
        >
          <input
            id={allId}
            type="checkbox"
            checked={CONSENT_ITEMS.every((i) => checked[i.key])}
            onChange={(e) =>
              setChecked({
                ageOver14: e.target.checked,
                termsAgreed: e.target.checked,
                privacyAgreed: e.target.checked,
                sensitiveAgreed: e.target.checked,
                marketingAgreed: e.target.checked,
              })
            }
            className="h-5 w-5 accent-primary-600"
          />
          전체 동의합니다 (선택 항목 포함)
        </label>
        {CONSENT_ITEMS.map((item) => (
          <ConsentRow key={item.key} item={item} checked={checked[item.key]} onToggle={(v) => toggle(item.key, v)} />
        ))}
      </fieldset>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending || !canSubmit} className={authButtonClass}>
        {pending ? "처리 중..." : "가입 완료하기"}
      </Button>
    </form>
  );
}

function ConsentRow({
  item,
  checked,
  onToggle,
}: {
  item: ConsentItem;
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="rounded-[10px] border border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            id={id}
            type="checkbox"
            name={item.key}
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-5 w-5 accent-primary-600"
          />
          <span
            className={
              item.required
                ? "rounded-[4px] bg-primary-100 px-1.5 py-0.5 text-xs font-bold text-primary-700"
                : "rounded-[4px] bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground"
            }
          >
            {item.required ? "필수" : "선택"}
          </span>
          {item.label}
        </label>
        {item.viewHref && (
          <Link
            href={item.viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-muted-foreground underline"
          >
            전문 보기 ↗
          </Link>
        )}
      </div>
    </div>
  );
}
