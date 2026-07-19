"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { submitSignupForm, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { authButtonClass, authFieldClass } from "./AuthShell";
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

type ConsentItem = {
  key: ConsentKey;
  required: boolean;
  label: string;
  viewHref?: string;
  detail?: string;
};

const CONSENT_ITEMS: ConsentItem[] = [
  { key: "ageOver14", required: true, label: "만 14세 이상입니다" },
  { key: "termsAgreed", required: true, label: "이용약관 동의", viewHref: "/legal/terms" },
  {
    key: "privacyAgreed",
    required: true,
    label: "개인정보 수집·이용 동의",
    viewHref: "/legal/privacy",
    detail:
      "수집 항목: 이름, 이메일, 휴대폰 번호, 역할 정보 / 이용 목적: 회원 식별, 서비스 제공, 협력자 연결 / 보유 기간: 회원 탈퇴 후 5년(관계 법령에 따름)",
  },
  { key: "sensitiveAgreed", required: true, label: "민감정보(건강·장애) 처리 동의", viewHref: "/legal/privacy" },
  {
    key: "marketingAgreed",
    required: false,
    label: "마케팅·이벤트 정보 수신",
    detail:
      "이메일·앱 알림을 통한 서비스 소식, 이벤트, 업데이트 안내. 동의하지 않아도 서비스 이용이 가능하며 언제든 철회할 수 있습니다.",
  },
];

/**
 * 통합 회원가입 폼 — 역할 선택·기본 정보·약관 동의를 한 화면에서 처리한다(2026-07-18,
 * 기존 4단계 위저드 RoleSelectGrid/ProfileForm/ConsentForm을 병합해 대체).
 * 제출 성공 시 서버 액션이 /signup/verify(이메일 OTP)로 리다이렉트한다 — 이 단계만은
 * Supabase 이메일 확인의 비동기 특성상 한 화면에 합칠 수 없어 별도로 남는다.
 *
 * 데스크톱(lg+)에서는 역할 선택(좌) / 기본정보+동의(우) 2단 레이아웃으로 넓은 화면을
 * 활용한다 — 기존엔 좁은 폭(모바일 기준) 그대로 늘어져 있었다(2026-07-19 피드백 반영).
 */
export function SignupForm({ invite }: { invite: string | null }) {
  const [state, formAction, pending] = useActionState<AuthActionState | undefined, FormData>(
    submitSignupForm,
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

  const allChecked = CONSENT_ITEMS.every((i) => checked[i.key]);
  const requiredConsentsMet = REQUIRED_CONSENTS.every((k) => checked[k]);
  const canSubmit = Boolean(role) && requiredConsentsMet;

  function toggleAll(value: boolean) {
    setChecked({
      ageOver14: value,
      termsAgreed: value,
      privacyAgreed: value,
      sensitiveAgreed: value,
      marketingAgreed: value,
    });
  }

  function toggle(key: ConsentKey, value: boolean) {
    setChecked((prev) => ({ ...prev, [key]: value }));
  }

  const nameId = useId();
  const emailId = useId();
  const pwId = useId();
  const pw2Id = useId();
  const phoneId = useId();
  const allId = useId();

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-6">
      <input type="hidden" name="role" value={role} />
      {invite && <input type="hidden" name="invite" value={invite} />}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <fieldset className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
          <legend className="text-sm font-bold text-foreground">어떤 역할로 시작하시나요?</legend>
          <div role="radiogroup" aria-label="역할 선택" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
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
                    "relative flex min-h-[100px] flex-col items-start gap-1 rounded-[14px] border-2 p-4 text-left transition-colors lg:min-h-0 lg:flex-row lg:items-center lg:gap-3",
                    active ? "border-primary-600 bg-primary-50" : "border-border bg-background hover:border-primary-400"
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white lg:static lg:ml-auto"
                    >
                      ✓
                    </span>
                  )}
                  <span aria-hidden="true" className="text-2xl">
                    {r.emoji}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-bold text-foreground">{r.label}</span>
                    <span className="text-xs text-muted-foreground">{r.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-1 flex-col gap-6">
          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-bold text-foreground">기본 정보</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={nameId} label="이름">
                <input
                  id={nameId}
                  name="fullName"
                  type="text"
                  required
                  aria-required="true"
                  autoComplete="name"
                  placeholder="실명을 입력하세요"
                  className={authFieldClass}
                />
              </Field>

              <Field id={phoneId} label="휴대폰 번호">
                <input
                  id={phoneId}
                  name="phone"
                  type="tel"
                  required
                  aria-required="true"
                  autoComplete="tel"
                  placeholder="010-0000-0000"
                  className={authFieldClass}
                />
              </Field>
            </div>

            <Field id={emailId} label="이메일" hint="이 이메일로 인증 메일이 발송됩니다.">
              <input
                id={emailId}
                name="email"
                type="email"
                required
                aria-required="true"
                autoComplete="email"
                placeholder="name@example.com"
                className={authFieldClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id={pwId} label="비밀번호">
                <input
                  id={pwId}
                  name="password"
                  type="password"
                  required
                  aria-required="true"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="8자 이상"
                  className={authFieldClass}
                />
              </Field>
              <Field id={pw2Id} label="비밀번호 확인">
                <input
                  id={pw2Id}
                  name="passwordConfirm"
                  type="password"
                  required
                  aria-required="true"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="다시 입력"
                  className={authFieldClass}
                />
              </Field>
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
                checked={allChecked}
                onChange={(e) => toggleAll(e.target.checked)}
                className="h-5 w-5 accent-primary-600"
              />
              전체 동의합니다 (선택 항목 포함)
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              {CONSENT_ITEMS.map((item) => (
                <ConsentRow
                  key={item.key}
                  item={item}
                  checked={checked[item.key]}
                  onToggle={(v) => toggle(item.key, v)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending || !canSubmit} className={authButtonClass}>
        {pending ? "처리 중..." : "가입하기"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
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
      {item.detail && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-primary-700">자세히 보기</summary>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
        </details>
      )}
    </div>
  );
}
