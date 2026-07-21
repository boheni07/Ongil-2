import { getSupporterJournals } from "@/app/(app)/journal/actions";
import { JournalManager } from "@/components/supporter/JournalManager";

/**
 * S-13 일지 목록 — 좌(검색+목록)·우(상세) 분할은 `JournalManager`가 전담한다(2026-07-21,
 * 기록관리·타임라인과 동일한 구성으로 재구성했다 — 이전엔 목록만 있고 선택 시 별도 상세
 * 페이지로 이동하는 방식이었다).
 */
export default async function JournalListPage() {
  const journals = await getSupporterJournals(50);
  return <JournalManager initialItems={journals} />;
}
