"use client";

import { useActionState, useState } from "react";
import { selectRole, type AuthActionState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { authButtonClass } from "./AuthShell";
import { cn } from "@/lib/utils";

type RoleOption = {
  value: string;
  emoji: string;
  label: string;
  desc: string;
};

const ROLE_OPTIONS: RoleOption[] = [
  { value: "person", emoji: "🙋", label: "당사자", desc: "내 삶을 내가 기록" },
  { value: "guardian", emoji: "👪", label: "보호자", desc: "가족을 대신해 관리" },
  { value: "supporter", emoji: "🤝", label: "활동지원사", desc: "현장 활동 기록" },
  { value: "teacher", emoji: "🏫", label: "특수교사", desc: "IEP·관찰 기록" },
  { value: "social_worker", emoji: "🧑‍💼", label: "사회복지사", desc: "ISP·전환 지원" },
  { value: "therapist", emoji: "🩺", label: "치료사", desc: "치료계획·회기" },
];

export function RoleSelectGrid({ invite }: { invite: string | null }) {
  const [state, formAction, pending] = useActionState<
    AuthActionState | undefined,
    FormData
  >(selectRole, undefined);
  const [selected, setSelected] = useState<string>("");

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5">
      <input type="hidden" name="role" value={selected} />
      {invite && <input type="hidden" name="invite" value={invite} />}

      <div
        role="radiogroup"
        aria-label="역할 선택"
        className="grid grid-cols-2 gap-3"
      >
        {ROLE_OPTIONS.map((r) => {
          const active = selected === r.value;
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(r.value)}
              className={cn(
                "relative flex min-h-[112px] flex-col items-start gap-1 rounded-[14px] border-2 p-4 text-left transition-colors",
                active
                  ? "border-primary-600 bg-primary-50"
                  : "border-border bg-background hover:border-primary-400"
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white"
                >
                  ✓
                </span>
              )}
              <span aria-hidden="true" className="text-2xl">
                {r.emoji}
              </span>
              <span className="text-[15px] font-bold text-foreground">
                {r.label}
              </span>
              <span className="text-xs text-muted-foreground">{r.desc}</span>
            </button>
          );
        })}
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending || !selected}
        className={authButtonClass}
      >
        {pending ? "처리 중..." : "다음 →"}
      </Button>
    </form>
  );
}
