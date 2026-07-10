"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import {
  submitConsents,
  type AuthActionState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { authButtonClass } from "./AuthShell";

type ConsentKey =
  | "ageOver14"
  | "termsAgreed"
  | "privacyAgreed"
  | "sensitiveAgreed"
  | "marketingAgreed";

const REQUIRED: ConsentKey[] = [
  "ageOver14",
  "termsAgreed",
  "privacyAgreed",
  "sensitiveAgreed",
];

type Item = {
  key: ConsentKey;
  required: boolean;
  label: string;
  viewHref?: string;
  detail?: string;
};

const ITEMS: Item[] = [
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
  {
    key: "sensitiveAgreed",
    required: true,
    label: "민감정보(건강·장애) 처리 동의",
    viewHref: "/legal/privacy",
  },
  {
    key: "marketingAgreed",
    required: false,
    label: "마케팅·이벤트 정보 수신",
    detail:
      "이메일·앱 알림을 통한 서비스 소식, 이벤트, 업데이트 안내. 동의하지 않아도 서비스 이용이 가능하며 언제든 철회할 수 있습니다.",
  },
];

export function ConsentForm({ invite }: { invite: string | null }) {
  const [state, formAction, pending] = useActionState<
    AuthActionState | undefined,
    FormData
  >(submitConsents, undefined);
  const allId = useId();
  const [checked, setChecked] = useState<Record<ConsentKey, boolean>>({
    ageOver14: false,
    termsAgreed: false,
    privacyAgreed: false,
    sensitiveAgreed: false,
    marketingAgreed: false,
  });

  const allChecked = ITEMS.every((i) => checked[i.key]);
  const requiredMet = REQUIRED.every((k) => checked[k]);

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

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      {invite && <input type="hidden" name="invite" value={invite} />}

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

      {ITEMS.map((item) => (
        <ConsentRow
          key={item.key}
          item={item}
          checked={checked[item.key]}
          onToggle={(v) => toggle(item.key, v)}
        />
      ))}

      {state?.error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending || !requiredMet}
        className={`${authButtonClass} mt-3`}
      >
        {pending ? "처리 중..." : "동의하고 계속 →"}
      </Button>
    </form>
  );
}

function ConsentRow({
  item,
  checked,
  onToggle,
}: {
  item: Item;
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="rounded-[10px] border border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm text-foreground"
        >
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
            className="shrink-0 text-xs text-muted-foreground underline"
          >
            전문 보기
          </Link>
        )}
      </div>
      {item.detail && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-primary-700">
            자세히 보기
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {item.detail}
          </p>
        </details>
      )}
    </div>
  );
}
