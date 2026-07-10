"use client";

import { useActionState, useId } from "react";
import { confirmPasswordReset } from "../../actions";
import { Button } from "@/components/ui/button";
import {
  AuthCard,
  AuthDesc,
  AuthLogo,
  AuthTitle,
  authButtonClass,
  authFieldClass,
} from "@/components/auth/AuthShell";

export default function ResetConfirmPage() {
  const [state, formAction, pending] = useActionState(
    confirmPasswordReset,
    undefined
  );
  const pwId = useId();
  const pw2Id = useId();

  return (
    <AuthCard>
      <AuthLogo />
      <AuthTitle>새 비밀번호 설정</AuthTitle>
      <AuthDesc>새로 사용할 비밀번호를 입력해 주세요</AuthDesc>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={pwId} className="text-sm font-medium text-foreground">
            새 비밀번호
          </label>
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
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={pw2Id} className="text-sm font-medium text-foreground">
            새 비밀번호 확인
          </label>
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
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </form>
    </AuthCard>
  );
}
