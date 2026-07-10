"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { requestPasswordReset } from "../actions";
import { Button } from "@/components/ui/button";
import {
  AuthCard,
  AuthDesc,
  AuthLogo,
  AuthTitle,
  authButtonClass,
  authFieldClass,
} from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    undefined
  );
  const emailId = useId();

  return (
    <AuthCard>
      <AuthLogo />
      <AuthTitle>비밀번호 재설정</AuthTitle>
      <AuthDesc>가입하신 이메일로 재설정 링크를 보내드립니다</AuthDesc>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="text-sm font-medium text-foreground">
            이메일
          </label>
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
          <p className="text-xs text-muted-foreground">
            등록된 이메일이면 재설정 링크가 발송됩니다.
          </p>
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p role="status" className="text-sm text-primary-700">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "발송 중..." : "재설정 링크 받기"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-primary-700 underline">
          ← 로그인으로 돌아가기
        </Link>
      </p>
    </AuthCard>
  );
}
