"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  resendOtp,
  verifyEmailOtp,
  type AuthActionState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { authButtonClass } from "./AuthShell";

const LEN = 6;
const RESEND_SECONDS = 60;

export function OtpInput({
  email,
  invite,
  marketing = false,
}: {
  email: string;
  invite: string | null;
  marketing?: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    AuthActionState | undefined,
    FormData
  >(verifyEmailOtp, undefined);
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const token = digits.join("");

  function setDigit(i: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = digit;
      return next;
    });
    if (digit && i < LEN - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(LEN).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    refs.current[Math.min(pasted.length, LEN - 1)]?.focus();
  }

  async function handleResend() {
    setResendMsg(null);
    const res = await resendOtp(email);
    setResendMsg(res.error ?? res.message ?? null);
    setCountdown(RESEND_SECONDS);
  }

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="marketing" value={marketing ? "1" : "0"} />
      {invite && <input type="hidden" name="invite" value={invite} />}

      <div className="flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            aria-label={`인증코드 ${i + 1}`}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className="h-14 w-full min-w-0 rounded-[10px] border border-border bg-background text-center text-xl font-bold text-foreground outline-none focus-visible:border-primary-600"
          />
        ))}
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {resendMsg && (
        <p role="status" className="text-sm text-primary-700">
          {resendMsg}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending || token.length !== LEN}
        className={authButtonClass}
      >
        {pending ? "인증 중..." : "인증 완료"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        메일을 받지 못하셨나요?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={countdown > 0}
          className="font-medium text-primary-700 underline disabled:text-muted-foreground disabled:no-underline"
        >
          코드 재발송
        </button>
        {countdown > 0 && (
          <span className="ml-1 text-muted-foreground">({countdown}초)</span>
        )}
      </p>
    </form>
  );
}
