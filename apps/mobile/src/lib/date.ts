/** 화면 표시용 한국어 날짜 포맷 헬퍼. */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "7월 8일 화요일" */
export function formatKoreanDate(d = new Date()): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

/** ISO/날짜 문자열 → "7월 8일" (파싱 실패 시 원문) */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** ISO → "오늘"/"어제"/"N일 전"/"M월 D일" */
export function relativeDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  const days = Math.floor(
    (today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000
  );
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return formatShortDate(iso);
}

/** 생년월일(YYYY-MM-DD) → 만 나이 */
export function koreanAge(birthISO: string): number | null {
  const b = new Date(birthISO);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}
