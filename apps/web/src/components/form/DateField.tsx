"use client";

import { cn } from "@/lib/utils";

/**
 * 날짜 입력 공용 컴포넌트 — 두 가지 입력 경로를 모두 지원한다(2026-07-19,
 * 전 화면 입력항목 표준화 라운드).
 * 1) 직접 타이핑: 숫자만 받아들여 "YYYY-MM-DD" 형식으로 실시간 자동 변환한다
 *    (예: "20260711" 입력 → "2026-07-11" 표시).
 * 2) 달력 선택: 텍스트 입력 오른쪽에 네이티브 `<input type="date">`를 투명하게
 *    겹쳐 둬 클릭하면 브라우저 기본 달력이 뜬다 — showPicker() 같은 브라우저별
 *    지원 편차가 있는 API에 기대지 않고 두 입력 모두 항상 동작하게 만든다.
 * value/onChange는 항상 "YYYY-MM-DD"(빈 값이면 "") 문자열을 주고받는다.
 */
export function DateField({
  value,
  onChange,
  className,
  id,
  required,
  disabled,
  placeholder = "YYYY-MM-DD",
  min,
  max,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** "YYYY-MM-DD" — 달력 선택 범위 제한(직접 타이핑 값은 제출 시 별도 검증 필요). */
  min?: string;
  max?: string;
  "aria-label"?: string;
}) {
  function handleTextChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length > 6) formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    onChange(formatted);
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={placeholder}
        maxLength={10}
        required={required}
        aria-required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(className, "pr-10")}
      />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="달력에서 날짜 선택"
        disabled={disabled}
        min={min}
        max={max}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 w-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
      >
        📅
      </span>
    </div>
  );
}
