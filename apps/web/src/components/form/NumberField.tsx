"use client";

import { cn } from "@/lib/utils";

/**
 * 큰 자릿수 숫자 입력 공용 컴포넌트(2026-07-19, 전 화면 입력항목 표준화 라운드).
 * 숫자만 받아들여 천 단위 구분 쉼표를 실시간으로 붙인다(예: "1234000" → "1,234,000").
 * value/onChange는 쉼표 없는 순수 숫자 문자열을 주고받는다 — 표시 포맷팅은 렌더 시점에만
 * 적용해, 저장/검증 로직이 쉼표를 신경 쓰지 않아도 되게 한다.
 *
 * 참고: 0~100 같은 작은 범위 값(점수·시간 등)은 네이티브 `type="number"`(min/max)만으로도
 * 이미 숫자만 입력되므로 이 컴포넌트가 필요 없다 — 자릿수가 커져 쉼표 구분이 실제로
 * 읽기 편해지는 값(참여 인원·건수 등 4자리 이상 가능성이 있는 값)에만 사용한다.
 */
export function NumberField({
  value,
  onChange,
  className,
  id,
  required,
  disabled,
  placeholder,
}: {
  /** 쉼표 없는 순수 숫자 문자열 (예: "1234000") */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const display = value ? Number(value).toLocaleString("ko-KR") : "";

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    onChange(digits.replace(/^0+(?=\d)/, ""));
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={cn(className)}
    />
  );
}
