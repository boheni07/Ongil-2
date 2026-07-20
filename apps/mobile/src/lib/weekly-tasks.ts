/**
 * docs/14 워크숍 Wave W-1/W-4 — "이번 주 처리할 일"(마감일 기반) 공용 계산. 웹 동형
 * (apps/web/src/lib/weekly-tasks.ts). "완료" 여부를 별도로 추적하지 않는다 — 마감 전에
 * 같은 record_type으로 새 기록이 제출되면 그 기록의 최신 마감일이 미래로 갱신되어 자동으로
 * 목록에서 빠진다.
 */

export interface WeeklyTaskItem {
  personId: string;
  personName: string;
  recordType: string;
  /** 예: "행동중재계획(BIP) 재검토" */
  label: string;
  /** 오늘 기준 남은 일수. 음수면 기한 초과. */
  dday: number;
  /** 탭 시 해당 화면으로 이동(각 홈 화면이 자신의 navigation으로 구성). */
  onPress: () => void;
}

/** YYYY-MM-DD 문자열의 오늘 기준 D-day. 로컬 자정 기준(TZ 드리프트 방지). 파싱 불가면 null. */
export function ddayFrom(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "이번 주"= 기한 초과 포함, 오늘부터 7일 이내(D-7까지). */
export const WEEKLY_WINDOW_DAYS = 7;

export function isWithinWeek(dday: number): boolean {
  return dday <= WEEKLY_WINDOW_DAYS;
}

/** dday 오름차순(기한 초과 먼저) 정렬 후 반환. */
export function sortWeeklyTasks(items: WeeklyTaskItem[]): WeeklyTaskItem[] {
  return [...items].sort((a, b) => a.dday - b.dday);
}
