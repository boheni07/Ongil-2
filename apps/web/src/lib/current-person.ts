import { cookies } from "next/headers";

/**
 * 보호자가 마지막으로 선택한 "현재 당사자"를 브라우저 재방문 간에도 유지하기 위한 쿠키.
 * 화면 내 즉시 반영은 `CurrentPersonProvider`(클라이언트 Context)가 담당하고,
 * 이 쿠키는 새 세션/전체 새로고침 시 초기값을 복원하는 용도다.
 */
export const CURRENT_PERSON_COOKIE = "ongil_current_person";

/** 쿠키 값이 실제 이 보호자의 당사자 목록에 있는지 검증 후 초기 선택값을 정한다. */
export async function resolveCurrentPersonId(personIds: string[]): Promise<string | null> {
  if (personIds.length === 0) return null;
  const store = await cookies();
  const raw = store.get(CURRENT_PERSON_COOKIE)?.value;
  if (raw && personIds.includes(raw)) return raw;
  return personIds[0];
}
