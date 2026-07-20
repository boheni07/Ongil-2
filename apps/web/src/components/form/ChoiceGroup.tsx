"use client";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

/**
 * 콤보박스 대신 쓰는 라디오 타일 선택 — 고정된 소수 옵션(2~6개)의 enum 필드용.
 * 전체 선택지가 한 번에 펼쳐져 있어 드롭다운을 열지 않아도 스캔할 수 있고, 터치 타겟도
 * <select>보다 크다. 옵션 수가 가변적/많은 필드(예: 당사자 선택)는 대상이 아니다 —
 * 그런 목록형 선택은 기존 <select>를 그대로 쓴다.
 */
export function ChoiceGroup<T extends string>({
  value,
  onChange,
  options,
  disabled,
  columns = "auto",
  ariaLabel,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: readonly ChoiceOption<T>[];
  disabled?: boolean;
  columns?: "auto" | 2 | 3 | 4;
  ariaLabel?: string;
}) {
  const colsClass =
    columns === "auto"
      ? "grid-cols-2 sm:grid-cols-3"
      : columns === 2
        ? "grid-cols-2"
        : columns === 3
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`grid gap-2 ${colsClass}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-(--br-md) border-2 px-3 py-2 text-body font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            value === o.value
              ? "border-primary-600 bg-primary-50 text-primary-800"
              : "border-border text-accent-stone hover:border-primary-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 복수선택 버전(체크 타일) — fba_basis 등 배열형 enum 필드용. */
export function ChoiceCheckGroup<T extends string>({
  value,
  onChange,
  options,
  columns = "auto",
  ariaLabel,
}: {
  value: T[];
  onChange: (v: T[]) => void;
  options: readonly ChoiceOption<T>[];
  columns?: "auto" | 2 | 3 | 4;
  ariaLabel?: string;
}) {
  const colsClass =
    columns === "auto"
      ? "grid-cols-2 sm:grid-cols-3"
      : columns === 2
        ? "grid-cols-2"
        : columns === 3
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";
  function toggle(v: T) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }
  return (
    <div role="group" aria-label={ariaLabel} className={`grid gap-2 ${colsClass}`}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={`min-h-11 rounded-(--br-md) border-2 px-3 py-2 text-body font-semibold transition-colors ${
              on
                ? "border-primary-600 bg-primary-50 text-primary-800"
                : "border-border text-accent-stone hover:border-primary-400"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
