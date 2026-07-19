"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { setCurrentPerson } from "@/app/(app)/dashboard/actions";

export interface CurrentPersonOption {
  id: string;
  fullName: string;
  birthDate: string;
}

interface CurrentPersonContextValue {
  personId: string | null;
  persons: CurrentPersonOption[];
  setPersonId: (id: string) => void;
}

const CurrentPersonContext = createContext<CurrentPersonContextValue | null>(null);

/**
 * 보호자 레이아웃 전역에서 "현재 당사자" 선택을 공유하는 Context — 헤더 콤보박스(G-01
 * 프로토타입의 `#hdr-person`)와 대시보드 PersonSlider가 이 하나의 상태를 함께 읽고 쓴다.
 * layout.tsx(Server Component)가 쿠키로 복원한 초기값을 넘겨주면, 이후 전환은 클라이언트
 * 상태로만 즉시 반영(리렌더 없음)하고, 쿠키는 setCurrentPerson으로 fire-and-forget 갱신해
 * 다음 방문 때의 초기값만 맞춘다.
 */
export function CurrentPersonProvider({
  initialPersonId,
  persons,
  children,
}: {
  initialPersonId: string | null;
  persons: CurrentPersonOption[];
  children: ReactNode;
}) {
  const [personId, setPersonIdState] = useState(initialPersonId);

  const setPersonId = useCallback((id: string) => {
    setPersonIdState(id);
    void setCurrentPerson(id);
  }, []);

  return (
    <CurrentPersonContext.Provider value={{ personId, persons, setPersonId }}>
      {children}
    </CurrentPersonContext.Provider>
  );
}

/** Provider 밖(비보호자 레이아웃)에서 호출되면 빈 상태를 반환 — 방어적 기본값. */
export function useCurrentPerson(): CurrentPersonContextValue {
  const ctx = useContext(CurrentPersonContext);
  if (!ctx) {
    return { personId: null, persons: [], setPersonId: () => {} };
  }
  return ctx;
}
