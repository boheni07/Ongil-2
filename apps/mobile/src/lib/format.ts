/**
 * 입력 표시 형식 포맷터(2026-07-19, 웹 components/form/{DateField,PhoneField}.tsx와
 * 동일 로직을 RN 전용으로 이식). 숫자만 받아 실시간으로 표준 형식 문자열로 바꾼다.
 */

/**
 * "20260711" 같은 숫자열을 "2026-07-11"로 변환(자릿수가 찰 때마다 하이픈 자동 삽입).
 * 월은 1~12, 일은 해당 월의 실제 마지막 날짜(윤년 포함)를 넘지 않도록 두 자리가
 * 채워지는 즉시 실시간으로 보정한다(예: "13"월 → "12", "2월 30일" → "2월 28/29일").
 * min/max("YYYY-MM-DD")가 주어지면 값이 완성되는 즉시 그 범위로도 clamp한다 —
 * 시작일/종료일 쌍에서 종료일이 시작일보다 앞서지 않도록 강제할 때 쓴다.
 */
export function formatDateInput(raw: string, min?: string, max?: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const year = digits.slice(0, 4);
  let month = digits.slice(4, 6);
  let day = digits.slice(6, 8);

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

  if (formatted.length === 10) {
    if (min && formatted < min) return min;
    if (max && formatted > max) return max;
  }
  return formatted;
}

/**
 * "202607181430" 같은 숫자열을 "2026-07-18T14:30"으로 변환(datetime-local과 동일 형식).
 * 날짜 부분은 formatDateInput과 동일하게 월 1~12·일 자릿수 clamp를 적용하고,
 * 시간 부분도 시 0~23·분 0~59로 실시간 clamp한다.
 */
export function formatDateTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  const datePart = formatDateInput(digits.slice(0, 8));
  let hour = digits.slice(8, 10);
  let minute = digits.slice(10, 12);

  if (hour.length === 2) hour = String(Math.min(23, Number(hour))).padStart(2, "0");
  if (minute.length === 2) minute = String(Math.min(59, Number(minute))).padStart(2, "0");

  let formatted = datePart;
  if (datePart.length === 10 && hour) formatted += `T${hour}`;
  if (hour.length === 2 && minute) formatted += `:${minute}`;
  return formatted;
}

/**
 * 국내 전화번호 표시 형식 변환.
 *   - 010/011 등 휴대폰, 031~064 등 3자리 지역번호: 3-3-4 → 3-4-4(자릿수가 차면 자동 확장)
 *   - 02(서울): 2-3-4 → 2-4-4
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

/** "1234000" → "1,234,000". NumberField(모바일)에서 사용. */
export function formatThousands(digitsOnly: string): string {
  if (!digitsOnly) return "";
  return Number(digitsOnly).toLocaleString("ko-KR");
}
