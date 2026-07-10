"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { login } from "../actions";
import { Button } from "@/components/ui/button";
import {
  AuthCard,
  AuthDesc,
  AuthLogo,
  AuthTitle,
  authButtonClass,
  authFieldClass,
} from "@/components/auth/AuthShell";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const emailId = useId();
  const pwId = useId();

  return (
    <AuthCard>
      <AuthLogo />
      <AuthTitle>다시 오신 것을 환영합니다</AuthTitle>
      <AuthDesc>계정에 로그인하여 기록을 이어가세요</AuthDesc>

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
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={pwId} className="text-sm font-medium text-foreground">
            비밀번호
          </label>
          <input
            id={pwId}
            name="password"
            type="password"
            required
            aria-required="true"
            minLength={8}
            autoComplete="current-password"
            placeholder="비밀번호 입력"
            className={authFieldClass}
          />
        </div>

        <div className="flex justify-end">
          <Link href="/reset-password" className="text-sm text-primary-700 underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "로그인 중..." : "로그인"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-medium text-primary-700 underline">
          회원가입
        </Link>
      </p>
    </AuthCard>
  );
}
