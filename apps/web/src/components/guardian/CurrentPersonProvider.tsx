"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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
 * `/persons/{id}/...` 하위 경로 중 "당사자만 바뀌어도 그대로 이어서 보여줘도 안전한" 경로만
 * 허용한다. `/records/{recordId}(/edit)`처럼 특정 레코드 하나를 가리키는 경로는 당사자가
 * 바뀌면 의미 자체가 달라지므로(다른 사람의 기록을 새 당사자 URL로 잘못 열게 됨) 제외한다.
 */
const SAFE_PERSON_SUFFIXES = new Set([
  "",
  "/timeline",
  "/records",
  "/records/new",
  "/records/express",
  "/permissions",
  "/permissions/grant",
  "/access-logs",
]);

/**
 * 보호자 레이아웃 전역에서 "현재 당사자" 선택을 공유하는 Context — 헤더 콤보박스(G-01
 * 프로토타입의 `#hdr-person`)와 대시보드 PersonSlider가 이 하나의 상태를 함께 읽고 쓴다.
 * layout.tsx(Server Component)가 쿠키로 복원한 초기값을 넘겨주면, 이후 전환은 클라이언트
 * 상태로만 즉시 반영(리렌더 없음)하고, 쿠키는 setCurrentPerson으로 fire-and-forget 갱신해
 * 다음 방문 때의 초기값만 맞춘다.
 *
 * 2026-07-20 피드백: 기록 작성 화면 등 특정 당사자로 고정된 화면에서 헤더로 당사자를
 * 바꾸면, "지금 보고 있는 화면 내용"도 새 당사자 기준으로 갈아타야 한다 — 헤더만 바뀌고
 * 화면은 이전 당사자에 머물러 있으면 혼란스럽다. `/persons/{id}/...`는 안전한 하위 경로일
 * 때만 새 당사자 URL로 교체하고, `?personId=`가 있는 화면(RecordTypePicker에서 이어지는
 * `/records/{type}/new?personId=` 구조화 서식들)은 쿼리 값을 갱신해 같은 화면을 유지한 채
 * 대상만 바꾼다. 둘 다 router.replace로 처리해 "이전 당사자용 화면" 히스토리를 남기지 않는다.
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
  const pathname = usePathname();
  const router = useRouter();
  const [personId, setPersonIdState] = useState(initialPersonId);

  const setPersonId = useCallback(
    (id: string) => {
      setPersonIdState(id);
      void setCurrentPerson(id);

      const personsMatch = pathname.match(/^\/persons\/([^/]+)((?:\/.*)?)$/);
      if (personsMatch && personsMatch[1] !== id && SAFE_PERSON_SUFFIXES.has(personsMatch[2])) {
        router.replace(`/persons/${id}${personsMatch[2]}`);
        return;
      }

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.has("personId") && url.searchParams.get("personId") !== id) {
          url.searchParams.set("personId", id);
          router.replace(`${url.pathname}?${url.searchParams.toString()}`);
        }
      }
    },
    [pathname, router]
  );

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
