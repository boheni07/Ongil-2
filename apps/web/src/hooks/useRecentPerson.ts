"use client";

import { useEffect, useState } from "react";

const KEY = "ongil_recent_person";

function readRecent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeRecent(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // 프라이빗 브라우징 등으로 localStorage 접근이 막혀도 무시 — 힌트일 뿐 필수 기능은 아니다.
  }
}

/**
 * 전문직군 작성/조회 화면의 대상자 select — docs/13 Wave Q-2.
 * 화면에 personId가 이미 정해져 있지 않을 때(예: Home의 공용 액션 버튼처럼 특정 학생 맥락
 * 없이 곧장 진입한 경우), 목록 맨 앞이 아니라 "최근 선택했던 대상자"를 기본값으로 쓴다.
 * 선택을 강제로 고정하지는 않는다 — docs/13 §2 토론 결론(사회복지사·활동지원사 페르소나가
 * "매번 다시 고르는 게 오히려 안전장치"라고 지지)에 따라 보호자식 전역 Context는 쓰지 않고,
 * 힌트(기본 선택값)로만 작동한다. localStorage는 SSR 시점엔 없으므로 초기 렌더는 항상
 * initialPersonId/목록 첫 항목으로 하고, 마운트 후 useEffect에서만 "최근 선택"으로 보정해
 * 하이드레이션 불일치를 피한다.
 */
export function usePersonSelection<T extends { personId: string }>(
  list: T[],
  initialPersonId?: string
): [string, (id: string) => void] {
  const [personId, setPersonIdState] = useState(
    initialPersonId && list.some((x) => x.personId === initialPersonId)
      ? initialPersonId
      : (list[0]?.personId ?? "")
  );

  useEffect(() => {
    if (initialPersonId) return;
    const recent = readRecent();
    if (recent && recent !== personId && list.some((x) => x.personId === recent)) {
      setPersonIdState(recent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만 보정한다.
  }, []);

  // 2026-07-20: 보호자 헤더 콤보박스(CurrentPersonProvider)가 `?personId=` 쿼리를
  // 바꿔치기해 같은 화면을 유지한 채 대상자만 전환하는 경로가 생겼다 — 이 경우 페이지
  // 컴포넌트는 리마운트되지 않고 initialPersonId prop만 바뀌므로 이 effect로 따라간다.
  useEffect(() => {
    if (initialPersonId && list.some((x) => x.personId === initialPersonId)) {
      setPersonIdState((prev) => (prev === initialPersonId ? prev : initialPersonId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialPersonId 변경에만 반응한다.
  }, [initialPersonId]);

  function setPersonId(id: string) {
    setPersonIdState(id);
    writeRecent(id);
  }

  return [personId, setPersonId];
}
