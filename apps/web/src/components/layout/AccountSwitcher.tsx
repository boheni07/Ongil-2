"use client";

import { devSwitchAccount } from "@/app/(auth)/actions";

/**
 * 사이드바 최하단 "테스트 계정 전환" — supabase/seed.sql의 7개 로컬 목업 계정을 화면 전환
 * 없이 즉시 바꿔가며 스팟체크할 수 있도록 한다(2026-07-19, 검수 단계 편의 요청).
 * 계정 목록·비밀번호는 devSwitchAccount(actions.ts)의 화이트리스트와 반드시 동일해야 한다.
 */
const DEV_ACCOUNTS = [
  { email: "guardian1@ongil.test", label: "보호자1 · 김보호" },
  { email: "guardian2@ongil.test", label: "보호자2 · 이보호" },
  { email: "person1@ongil.test", label: "당사자 · 박당사" },
  { email: "supporter1@ongil.test", label: "활동지원사 · 최지원" },
  { email: "teacher1@ongil.test", label: "특수교사 · 정교사" },
  { email: "social1@ongil.test", label: "사회복지사 · 한복지" },
  { email: "therapist1@ongil.test", label: "치료사 · 오치료" },
];

export function AccountSwitcher({ currentEmail }: { currentEmail: string | null }) {
  return (
    <form action={devSwitchAccount} className="border-t border-primary-700 p-2">
      <label
        htmlFor="dev-account-switch"
        className="mb-1 block px-1 text-[10px] font-bold tracking-wide text-primary-200 uppercase"
      >
        테스트 계정 전환
      </label>
      <select
        id="dev-account-switch"
        name="email"
        defaultValue={currentEmail ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-h-9 w-full rounded-(--br-md) border border-primary-600 bg-primary-900 px-2 text-xs font-semibold text-white outline-none focus-visible:border-accent-amber"
      >
        <option value="" disabled>
          계정 선택
        </option>
        {DEV_ACCOUNTS.map((a) => (
          <option key={a.email} value={a.email}>
            {a.label}
          </option>
        ))}
      </select>
    </form>
  );
}
