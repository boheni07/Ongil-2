"use client";

import { useActionState, useId } from "react";
import {
  submitProfile,
  type AuthActionState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { authButtonClass, authFieldClass } from "./AuthShell";

export function ProfileForm({
  role,
  invite,
}: {
  role: string;
  invite: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    AuthActionState | undefined,
    FormData
  >(submitProfile, undefined);
  const nameId = useId();
  const emailId = useId();
  const pwId = useId();
  const pw2Id = useId();
  const phoneId = useId();

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="role" value={role} />
      {invite && <input type="hidden" name="invite" value={invite} />}

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

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className={authButtonClass}>
        {pending ? "처리 중..." : "다음 →"}
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
