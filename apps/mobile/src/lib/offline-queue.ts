import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * P3-4 범용 오프라인 제출 큐 (F-CMN-06).
 * 오프라인에서 시도한 폼 제출을 AsyncStorage에 큐잉하고, 네트워크 복구 시
 * flushQueue로 일괄 재시도한다. 재시도 횟수 제한·백오프는 두지 않는다
 * (온라인 전환/포그라운드 복귀 때마다 전체 큐를 다시 시도하는 것으로 충분).
 *
 * 충돌 해결 정책("최신 임시저장본 우선")은 enqueue 시점에 적용한다:
 * 같은 dedupeKey(논리적 초안 식별자)를 가진 항목은 큐에 항상 최대 1건만 유지하며,
 * updatedAt이 더 최신인 쪽만 남긴다.
 */

const QUEUE_KEY = "offline:submit-queue";

export interface QueueEntry {
  id: string;
  formType: string;
  personId: string;
  payload: unknown;
  isDraft: boolean;
  updatedAt: string; // ISO
  dedupeKey: string;
}

export interface SubmitResult {
  ok?: boolean;
  error?: string;
  recordId?: string;
}

export type SubmitFn = (
  personId: string,
  payload: never,
  isDraft: boolean
) => Promise<SubmitResult>;

export interface FlushResult {
  synced: number;
  remaining: number;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readQueue(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : [];
  } catch {
    // 손상된 큐는 빈 큐로 취급 (다음 write에서 복구)
    return [];
  }
}

async function writeQueue(entries: QueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
}

/**
 * 큐에 항목을 추가한다. id/updatedAt은 생략 시 자동 생성한다.
 * 같은 dedupeKey가 이미 큐에 있으면, updatedAt이 더 최신인 한 건만 남긴다.
 */
export async function enqueue(
  input: Omit<QueueEntry, "id" | "updatedAt"> & { updatedAt?: string }
): Promise<QueueEntry> {
  const entry: QueueEntry = {
    ...input,
    id: newId(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };

  const queue = await readQueue();
  const others = queue.filter((e) => e.dedupeKey !== entry.dedupeKey);
  const sameKey = queue.filter((e) => e.dedupeKey === entry.dedupeKey);
  // 동일 dedupeKey 후보(기존 + 신규) 중 updatedAt 최신 1건만 유지
  const winner = [...sameKey, entry].reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));

  await writeQueue([...others, winner]);
  return winner;
}

/** 큐 전체(또는 formType 한정) 조회. */
export async function getQueue(formType?: string): Promise<QueueEntry[]> {
  const queue = await readQueue();
  return formType ? queue.filter((e) => e.formType === formType) : queue;
}

/** id로 큐 항목 제거. */
export async function removeFromQueue(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((e) => e.id !== id));
}

// 동시 flush로 같은 항목이 중복 제출되는 것을 막는 런타임 락(RN JS 단일 스레드).
let flushing = false;

/**
 * formType에 해당하는 큐 항목을 순회하며 submitFn으로 재제출한다.
 * 성공(ok)한 항목만 큐에서 제거하고, 실패(네트워크 에러 등)한 항목은 남겨두고
 * 다음 항목을 계속 진행한다(한 건 실패가 전체 flush를 막지 않게).
 */
export async function flushQueue(formType: string, submitFn: SubmitFn): Promise<FlushResult> {
  if (flushing) {
    return { synced: 0, remaining: (await getQueue(formType)).length };
  }
  flushing = true;
  try {
    const target = (await readQueue()).filter((e) => e.formType === formType);
    let synced = 0;
    for (const entry of target) {
      try {
        const res = await submitFn(entry.personId, entry.payload as never, entry.isDraft);
        if (res.ok) {
          await removeFromQueue(entry.id);
          synced += 1;
        }
        // res.error 등 미성공 항목은 큐에 남겨 다음 flush에서 재시도
      } catch {
        // 네트워크 예외 — 큐에 남겨두고 다음 항목 계속
      }
    }
    const remaining = (await readQueue()).filter((e) => e.formType === formType).length;
    return { synced, remaining };
  } finally {
    flushing = false;
  }
}
