"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonProfileInput } from "@ongil/validation";
import { ensurePersonProfile } from "@/app/(app)/home/actions";
import { DateField } from "@/components/form/DateField";

/**
 * P-01 최초 진입 시 persons 행이 없을 때 뜨는 "내 프로필 만들기" — 최소 정보만 받아
 * ensurePersonProfile 호출 후 홈을 새로고침한다(성공 시 정상 P-01 렌더).
 */
export function CreateProfileForm() {
  const router = useRouter();
  const nameId = useId();
  const birthId = useId();
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"" | "M" | "F" | "other">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const input: PersonProfileInput = {
      fullName,
      birthDate,
      ...(gender ? { gender } : {}),
    };
    const res = await ensurePersonProfile(input);
    if (res.error) {
      setPending(false);
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-foreground/10">
      <h2 className="text-2xl font-extrabold text-foreground">내 프로필 만들기</h2>
      <p className="mt-2 text-person-base text-accent-stone">
        기록을 시작하려면 먼저 간단한 정보를 알려주세요.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <label htmlFor={nameId} className="flex flex-col gap-2">
          <span className="text-person-base font-semibold text-accent-stone">이름</span>
          <input
            id={nameId}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            aria-required="true"
            placeholder="이름을 입력하세요"
            className="min-h-[56px] rounded-(--br-md) border-2 border-border bg-white px-4 text-person-base outline-none focus-visible:border-primary-600"
          />
        </label>

        <label htmlFor={birthId} className="flex flex-col gap-2">
          <span className="text-person-base font-semibold text-accent-stone">생년월일</span>
          <DateField
            id={birthId}
            value={birthDate}
            onChange={setBirthDate}
            required
            className="min-h-[56px] w-full rounded-(--br-md) border-2 border-border bg-white px-4 text-person-base outline-none focus-visible:border-primary-600"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-person-base font-semibold text-accent-stone">성별 (선택)</legend>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: "M", label: "남성" },
              { value: "F", label: "여성" },
              { value: "other", label: "선택 안 함" },
            ] as const).map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={gender === o.value}
                onClick={() => setGender(gender === o.value ? "" : o.value)}
                className={`min-h-[56px] rounded-(--br-md) border-2 text-person-base font-semibold transition-colors ${
                  gender === o.value
                    ? "border-primary-600 bg-primary-50 text-primary-800"
                    : "border-border text-accent-stone hover:border-primary-400"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-person-base font-semibold text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-[56px] rounded-(--br-md) bg-primary-600 text-person-base font-bold text-white disabled:opacity-40"
        >
          {pending ? "만드는 중..." : "프로필 만들기"}
        </button>
      </form>
    </div>
  );
}
