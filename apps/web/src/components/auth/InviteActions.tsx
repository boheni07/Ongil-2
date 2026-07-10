"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptInvite,
  declineInvite,
  type AuthActionState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { authButtonClass } from "./AuthShell";

export function InviteActions({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<
    AuthActionState | undefined,
    FormData
  >(acceptInvite, undefined);
  const [declineMsg, setDeclineMsg] = useState<string | null>(null);
  const [declining, startDecline] = useTransition();
  const router = useRouter();

  function handleDecline() {
    setDeclineMsg(null);
    startDecline(async () => {
      const res = await declineInvite(token);
      if (res.error) {
        setDeclineMsg(res.error);
      } else {
        router.push("/login");
      }
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {declineMsg && (
        <p role="alert" className="text-sm text-red-600">
          {declineMsg}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          disabled={pending || declining}
          className={authButtonClass}
        >
          {pending ? "처리 중..." : "초대 수락하기"}
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        onClick={handleDecline}
        disabled={pending || declining}
        className="h-12 w-full rounded-[10px] text-[15px] font-medium text-muted-foreground"
      >
        {declining ? "처리 중..." : "거절"}
      </Button>
    </div>
  );
}
