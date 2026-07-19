"use client";

import { cn } from "@/lib/utils";

/**
 * 날짜 입력 공용 컴포넌트 — 두 가지 입력 경로를 모두 지원한다(2026-07-19,
 * 전 화면 입력항목 표준화 라운드).
 * 1) 직접 타이핑: 숫자만 받아들여 "YYYY-MM-DD" 형식으로 실시간 자동 변환한다
 *    (예: "20260711" 입력 → "2026-07-11" 표시). 월은 1~12, 일은 해당 월의
 *    실제 마지막 날짜(윤년 포함)를 넘지 않도록 두 자리가 채워지는 즉시 실시간으로
 *    보정한다(예: "13"월 입력 시 "12"로, "2월 30일"은 "2월 28/29일"로 즉시 clamp).
 * 2) 달력 선택: 텍스트 입력 오른쪽에 네이티브 `<input type="date">`를 투명하게
 *    겹쳐 둬 클릭하면 브라우저 기본 달력이 뜬다 — showPicker() 같은 브라우저별
 *    지원 편차가 있는 API에 기대지 않고 두 입력 모두 항상 동작하게 만든다.
 * min/max가 주어지면 달력 선택 범위 제한뿐 아니라 직접 타이핑한 값도 완성되는
 * 즉시 그 범위로 clamp한다 — 시작일/종료일 쌍에서 "종료일은 시작일 이상이어야
 * 한다" 같은 상식적 제약을 실시간으로 강제하기 위함(호출부는 end 필드에
 * min={시작일}만 넘기면 된다).
 * value/onChange는 항상 "YYYY-MM-DD"(빈 값이면 "") 문자열을 주고받는다.
 */
function clampDateDigits(digitsIn: string): string {
  const year = digitsIn.slice(0, 4);
  let month = digitsIn.slice(4, 6);
  let day = digitsIn.slice(6, 8);

  if (month.length === 2) {
    const m = Math.min(12, Math.max(1, Number(month) || 1));
    month = String(m).padStart(2, "0");
  }
  if (day.length === 2) {
    const y = year.length === 4 ? Number(year) : new Date().getFullYear();
    const m = month.length === 2 ? Number(month) : 1;
    const maxDay = new Date(y, m, 0).getDate();
    const d = Math.min(maxDay, Math.max(1, Number(day) || 1));
    day = String(d).padStart(2, "0");
  }

  let formatted = year;
  if (month) formatted += `-${month}`;
  if (day) formatted += `-${day}`;
  return formatted;
}
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
  function clampToRange(formatted: string): string {
    if (formatted.length !== 10) return formatted;
    if (min && formatted < min) return min;
    if (max && formatted > max) return max;
    return formatted;
  }

  function handleTextChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    onChange(clampToRange(clampDateDigits(digits)));
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
        onChange={(e) => onChange(clampToRange(e.target.value))}
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
