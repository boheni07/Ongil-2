"use client";

import { cn } from "@/lib/utils";

/**
 * 전화번호 입력 공용 컴포넌트(2026-07-19, 전 화면 입력항목 표준화 라운드).
 * 숫자만 받아들여 국내 전화번호 관행에 맞게 실시간 자동 변환한다.
 *   - 010/011 등 휴대폰, 031~064 등 3자리 지역번호: 3-3-4 (예: 010-123-4567,
 *     입력이 끝까지 이어지면 3-4-4로 자동 확장: 010-1234-5678)
 *   - 02(서울): 2-3-4(예: 02-123-4567) → 8자리째부터 2-4-4(02-1234-5678)
 * value/onChange는 항상 하이픈 포함 표시 형식 문자열을 주고받는다(저장 시 필요하면
 * 호출부에서 하이픈을 제거하면 된다 — 이 컴포넌트는 표시 형식만 책임진다).
 */
export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";

  if (digits.startsWith("02")) {
    const rest = digits.slice(2);
    if (rest.length === 0) return "02";
    if (rest.length <= 3) return `02-${rest}`;
    if (rest.length <= 7) return `02-${rest.slice(0, 3)}-${rest.slice(3)}`;
    return `02-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  }

  const area = digits.slice(0, 3);
  const rest = digits.slice(3);
  if (rest.length === 0) return area;
  if (rest.length <= 3) return `${area}-${rest}`;
  if (rest.length <= 7) return `${area}-${rest.slice(0, 3)}-${rest.slice(3)}`;
  return `${area}-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
}

export function PhoneField({
  value,
  onChange,
  className,
  id,
  name,
  required,
  disabled,
  placeholder = "010-0000-0000",
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  /** FormData 기반(useActionState 등) 네이티브 폼 제출 시 필드명으로 사용. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type="tel"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(formatPhoneNumber(e.target.value))}
      placeholder={placeholder}
      maxLength={13}
      required={required}
      aria-required={required}
      disabled={disabled}
      autoComplete={autoComplete}
      className={cn(className)}
    />
  );
}
