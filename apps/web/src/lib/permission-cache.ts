import type { DomainKey, AccessLevel } from "@ongil/validation";

/**
 * NF-SEC-05 권한 TTL 캐시 유틸리티 — Upstash Redis REST API 얇은 클라이언트.
 * docs/01-prd.md:230, docs/05-erd.md §4-5④.
 *
 * ⚠️ 이 캐시는 RLS를 대체하지 않는다. RLS 정책(records_select/insert 등)은 항상 permissions
 * 라이브 테이블을 직접 조회해 즉시 평가한다 — 이 캐시는 애플리케이션 레이어가 "이 사용자가 이
 * 당사자의 이 도메인에 접근 가능한가"를 반복 조회할 때 DB 왕복을 줄이는 부가 최적화일 뿐이다.
 * 정확성은 두 축으로 유지된다: (1) TTL(기본 5분) 만료, (2) permissions 변경 시 DB 트리거
 * (trg_zz_invalidate_permission_cache)의 즉시 DEL. 이 파일은 그중 read/write/무효화 헬퍼를 제공한다.
 *
 * 이번 라운드는 유틸리티만 만들고 서버 액션에 wiring 하지 않는다(스코프 밖). 캐시는
 * optimization 이지 critical path 가 아니므로, Redis 미설정·호출 실패 시 전부 조용히
 * 무시하고(read 는 null 반환) 호출부가 DB 직접 조회로 폴백하게 둔다.
 *
 * 필요 환경변수(Next.js 서버 전용 — 클라이언트 노출 금지):
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * 미설정 시 모든 함수는 no-op(get 은 null).
 */

/** 캐시 기본 TTL(초). NF-SEC-05 "TTL 기반 만료"의 상한 — 필요 시 조정. */
export const PERMISSION_CACHE_TTL_SECONDS = 300;

/** 캐시에 저장되는 권한 스냅샷. permissions 라이브 행의 접근 판단 부분 집합. */
export type CachedPermission = {
  accessLevel: AccessLevel;
  isActive: boolean;
  validUntil: string | null;
};

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** 캐시 키 규격 — DB 트리거(invalidate_permission_cache)와 반드시 동일해야 한다. */
function cacheKey(granteeId: string, personId: string, domain: DomainKey): string {
  return `perm:${granteeId}:${personId}:${domain}`;
}

/** Upstash REST 명령 호출(fetch). 미설정·실패 시 null — 호출부가 해석. */
async function upstash(command: string[]): Promise<unknown | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    // Upstash REST: 명령을 경로 세그먼트로 전달. 각 인자는 URL 인코딩.
    const path = command.map((seg) => encodeURIComponent(seg)).join("/");
    const res = await fetch(`${REDIS_URL}/${path}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) return null;
    return json.result ?? null;
  } catch {
    // 캐시는 critical path 가 아니다 — 어떤 실패든 삼키고 폴백에 맡긴다.
    return null;
  }
}

/**
 * 캐시된 권한 조회(순수 read). 캐시 미스·Redis 미설정·에러 시 null 반환.
 * 이 함수는 폴백 로직을 갖지 않는다 — null 이면 호출부가 DB 직접 조회로 폴백한다.
 */
export async function getCachedPermission(
  granteeId: string,
  personId: string,
  domain: DomainKey
): Promise<CachedPermission | null> {
  const result = await upstash(["GET", cacheKey(granteeId, personId, domain)]);
  if (typeof result !== "string") return null;
  try {
    return JSON.parse(result) as CachedPermission;
  } catch {
    return null;
  }
}

/**
 * 권한 스냅샷을 TTL(EX)과 함께 캐시에 저장. 실패 시 조용히 무시.
 * Upstash REST: SET {key} {value} EX {ttl}
 */
export async function setCachedPermission(
  granteeId: string,
  personId: string,
  domain: DomainKey,
  value: CachedPermission,
  ttlSeconds: number = PERMISSION_CACHE_TTL_SECONDS
): Promise<void> {
  await upstash([
    "SET",
    cacheKey(granteeId, personId, domain),
    JSON.stringify(value),
    "EX",
    String(ttlSeconds),
  ]);
}

/**
 * 앱 코드에서 즉시 무효화(DB 트리거 경로와 별개). 예: 서버 액션이 permissions 를 직접
 * UPDATE 한 직후 트리거 완료를 기다리지 않고 낙관적으로 지우고 싶을 때. 실패 시 조용히 무시.
 * Upstash REST: DEL {key}
 */
export async function invalidatePermissionCache(
  granteeId: string,
  personId: string,
  domain: DomainKey
): Promise<void> {
  await upstash(["DEL", cacheKey(granteeId, personId, domain)]);
}
