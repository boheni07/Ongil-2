"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 시간 입력 공용 컴포넌트(2026-07-21) — DateField와 자매 컴포넌트지만, 12시간제 시(1~12)는
 * 1~2자리 가변 길이라 DateField처럼 "숫자 스트림 하나를 실시간으로 나눠 담는" 방식을 쓰면
 * 자릿수가 모호해진다(예: "930" 입력이 9시30분인지 93??분인지 구분 불가). 그래서 시/분을
 * 별도 입력칸 두 개로 나눠 직접 타이핑을 편하게 하고, 오전/오후는 눈에 보이는 토글 버튼으로
 * 분리해 한 번의 클릭으로 바꿀 수 있게 했다. value/onChange는 항상 24시간 "HH:MM"
 * (빈 값이면 "")으로 주고받아 `timeRegex`(packages/validation)와 그대로 호환된다.
 */

function parse24(hhmm: string): { period: "AM" | "PM"; hour: string; minute: string } | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [hh, mm] = hhmm.split(":").map(Number);
  const period: "AM" | "PM" = hh < 12 ? "AM" : "PM";
  let hour12 = hh % 12;
  if (hour12 === 0) hour12 = 12;
  return { period, hour: String(hour12), minute: String(mm).padStart(2, "0") };
}

function toHHMM(period: "AM" | "PM", hour: number, minute: number): string {
  let h = hour % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimeField({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const initial = parse24(value);
  const [period, setPeriod] = useState<"AM" | "PM">(initial?.period ?? "AM");
  const [hour, setHour] = useState(initial?.hour ?? "");
  const [minute, setMinute] = useState(initial?.minute ?? "");

  // 외부에서 value가 바뀌면(초안 불러오기 등) 내부 표시도 맞춘다.
  useEffect(() => {
    const p = parse24(value);
    if (p) {
      setPeriod(p.period);
      setHour(p.hour);
      setMinute(p.minute);
    } else if (value === "") {
      setHour("");
      setMinute("");
    }
  }, [value]);

  function commit(nextPeriod: "AM" | "PM", hourStr: string, minuteStr: string) {
    const h = Number(hourStr);
    const m = Number(minuteStr);
    if (hourStr !== "" && minuteStr.length === 2 && h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      onChange(toHHMM(nextPeriod, h, m));
    } else {
      onChange("");
    }
  }

  function handleHour(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const h = digits === "" ? "" : String(Math.min(12, Math.max(1, Number(digits))));
    setHour(h);
    commit(period, h, minute);
  }

  function handleMinute(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const m = digits.length === 2 ? String(Math.min(59, Number(digits))).padStart(2, "0") : digits;
    setMinute(m);
    commit(period, hour, m);
  }

  function handlePeriod(next: "AM" | "PM") {
    setPeriod(next);
    commit(next, hour, minute);
  }

  return (
    <div className={cn("flex items-stretch gap-1.5", className)} role="group" aria-label={ariaLabel}>
      <div className="flex overflow-hidden rounded-(--br-md) border border-border">
        <button
          type="button"
          aria-pressed={period === "AM"}
          onClick={() => handlePeriod("AM")}
          className={`min-h-11 px-3 text-body font-semibold transition-colors ${
            period === "AM" ? "bg-primary-600 text-white" : "bg-white text-muted-foreground hover:bg-muted"
          }`}
        >
          오전
        </button>
        <button
          type="button"
          aria-pressed={period === "PM"}
          onClick={() => handlePeriod("PM")}
          className={`min-h-11 border-l border-border px-3 text-body font-semibold transition-colors ${
            period === "PM" ? "bg-primary-600 text-white" : "bg-white text-muted-foreground hover:bg-muted"
          }`}
        >
          오후
        </button>
      </div>
      <input
        type="text"
        inputMode="numeric"
        value={hour}
        onChange={(e) => handleHour(e.target.value)}
        placeholder="시"
        maxLength={2}
        aria-label="시"
        className="min-h-11 w-14 rounded-(--br-md) border border-border bg-white px-2 text-center text-body text-foreground outline-none focus-visible:border-primary-600"
      />
      <span className="flex items-center text-body font-semibold text-muted-foreground">:</span>
      <input
        type="text"
        inputMode="numeric"
        value={minute}
        onChange={(e) => handleMinute(e.target.value)}
        placeholder="분"
        maxLength={2}
        aria-label="분"
        className="min-h-11 w-14 rounded-(--br-md) border border-border bg-white px-2 text-center text-body text-foreground outline-none focus-visible:border-primary-600"
      />
    </div>
  );
}
