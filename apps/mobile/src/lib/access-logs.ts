import { recordDisplayTitle, type DomainKey, type Role } from "@ongil/validation";
import { supabase } from "./supabase";

/**
 * G-40 접근 로그 조회 데이터 접근(모바일).
 * 웹 Server Action(apps/web/src/app/(app)/persons/[id]/access-logs/actions.ts)의 로직을
 * Supabase 직접 호출로 동일하게 재현한다. 필터·keyset 커서 페이지네이션 계약은 웹과 1:1 대응한다.
 *
 * 접근 통제는 전부 access_logs_select RLS(주보호자 한정, docs/05-erd.md §4-4)에 위임한다 —
 * 주보호자가 아니면 RLS가 자연히 빈 결과를 반환하므로 별도 권한 검사는 하지 않는다.
 *
 * "거부됨(deny)" 액션은 이번 범위 밖이다 — access_logs.action CHECK에 'deny'가 없고
 * (view/create/update/delete/export), RLS 차단은 앱에서 감지 자체가 불가하다. 필터·표시에서 제외한다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 20;

/** G-40 화면에서 다루는 동작 — 'delete'/'deny'는 이번 범위 밖. */
export type AccessLogActionKey = "view" | "create" | "update" | "export";

export interface AccessLogFilters {
  /** actor(이해관계자)의 역할 — users.role join 필터 */
  role?: Role;
  domain?: DomainKey;
  /** YYYY-MM-DD (해당 일자 00:00부터 포함) */
  dateFrom?: string;
  /** YYYY-MM-DD (해당 일자 23:59:59.999까지 포함) */
  dateTo?: string;
}

export interface AccessLogRow {
  id: string;
  accessedAt: string;
  actorName: string | null;
  actorRole: Role | null;
  domain: DomainKey | null;
  action: AccessLogActionKey;
  /** record_id가 있으면 대상 기록 제목, 없으면 대체 문구("목록 조회"). */
  recordTitle: string;
}

export interface AccessLogPage {
  items: AccessLogRow[];
  /** 다음 페이지 커서(base64). 더 없으면 null. */
  nextCursor: string | null;
}

interface RawActor {
  full_name: string | null;
  role: string | null;
}

interface RawRecord {
  record_type: string;
  content: unknown;
}

interface RawLogRow {
  id: string;
  accessed_at: string;
  action: string;
  domain: string | null;
  record_id: string | null;
  actor: RawActor | RawActor[] | null;
  record: RawRecord | RawRecord[] | null;
}

function firstOrSelf<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * ASCII 문자열 base64 인코딩/디코딩(RN엔 Node Buffer가 없다).
 * 커서 콘텐츠는 ISO 타임스탬프 + UUID + '|' 로 전부 ASCII라 바이트 단위 처리로 충분하다.
 */
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Encode(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 3) {
    const c0 = input.charCodeAt(i);
    const c1 = i + 1 < input.length ? input.charCodeAt(i + 1) : NaN;
    const c2 = i + 2 < input.length ? input.charCodeAt(i + 2) : NaN;
    const e0 = c0 >> 2;
    const e1 = ((c0 & 3) << 4) | (Number.isNaN(c1) ? 0 : c1 >> 4);
    const e2 = Number.isNaN(c1) ? 64 : ((c1 & 15) << 2) | (Number.isNaN(c2) ? 0 : c2 >> 6);
    const e3 = Number.isNaN(c2) ? 64 : c2 & 63;
    out += B64_CHARS[e0] + B64_CHARS[e1] + (e2 === 64 ? "=" : B64_CHARS[e2]) + (e3 === 64 ? "=" : B64_CHARS[e3]);
  }
  return out;
}

function base64Decode(input: string): string {
  const clean = input.replace(/=+$/, "");
  let out = "";
  for (let i = 0; i < clean.length; i += 4) {
    const e0 = B64_CHARS.indexOf(clean[i]);
    const e1 = B64_CHARS.indexOf(clean[i + 1]);
    const e2 = i + 2 < clean.length ? B64_CHARS.indexOf(clean[i + 2]) : -1;
    const e3 = i + 3 < clean.length ? B64_CHARS.indexOf(clean[i + 3]) : -1;
    out += String.fromCharCode((e0 << 2) | (e1 >> 4));
    if (e2 >= 0) out += String.fromCharCode(((e1 & 15) << 4) | (e2 >> 2));
    if (e3 >= 0) out += String.fromCharCode(((e2 & 3) << 6) | e3);
  }
  return out;
}

/** 커서 인코딩/디코딩 — accessed_at과 id를 함께 담아 동일 타임스탬프 tie를 안전하게 넘긴다. */
function encodeCursor(accessedAt: string, id: string): string {
  return base64Encode(`${accessedAt}|${id}`);
}

function decodeCursor(cursor: string): { accessedAt: string; id: string } | null {
  try {
    const decoded = base64Decode(cursor);
    const sep = decoded.indexOf("|");
    if (sep < 0) return null;
    return { accessedAt: decoded.slice(0, sep), id: decoded.slice(sep + 1) };
  } catch {
    return null;
  }
}

function toRow(raw: RawLogRow): AccessLogRow {
  const actor = firstOrSelf(raw.actor);
  const record = firstOrSelf(raw.record);
  const recordTitle =
    raw.record_id && record
      ? recordDisplayTitle(record.record_type, record.content)
      : "목록 조회";
  return {
    id: raw.id,
    accessedAt: raw.accessed_at,
    actorName: actor?.full_name ?? null,
    actorRole: (actor?.role as Role | null) ?? null,
    domain: (raw.domain as DomainKey | null) ?? null,
    action: raw.action as AccessLogActionKey,
    recordTitle,
  };
}

/**
 * G-40 접근 로그 페이지 조회. 역할·도메인·날짜 범위 필터 + keyset 무한 스크롤.
 * 접근 가능한 것만 RLS가 반환한다(주보호자가 아니면 빈 결과).
 */
export async function getAccessLogs(
  personId: string,
  filters: AccessLogFilters = {},
  cursor?: string
): Promise<AccessLogPage> {
  if (!UUID_RE.test(personId)) return { items: [], nextCursor: null };

  // 역할 필터가 있으면 actor(users) 임베드를 inner join으로 강제하고 actor.role로 필터한다.
  const actorEmbed = filters.role
    ? "actor:users!access_logs_actor_id_fkey!inner(full_name, role)"
    : "actor:users!access_logs_actor_id_fkey(full_name, role)";
  const selectCols = `id, accessed_at, action, domain, record_id, ${actorEmbed}, record:records!access_logs_record_id_fkey(record_type, content)`;

  let query = supabase
    .from("access_logs")
    .select(selectCols)
    .eq("person_id", personId)
    // 'delete'는 이번 범위 밖 — 화면에서 다루는 4종만 반환한다.
    .in("action", ["view", "create", "update", "export"])
    .order("accessed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (filters.role) query = query.eq("actor.role", filters.role);
  if (filters.domain) query = query.eq("domain", filters.domain);
  if (filters.dateFrom) query = query.gte("accessed_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) query = query.lte("accessed_at", `${filters.dateTo}T23:59:59.999`);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const { accessedAt, id } = decoded;
      query = query.or(
        `accessed_at.lt.${accessedAt},and(accessed_at.eq.${accessedAt},id.lt.${id})`
      );
    }
  }

  const { data, error } = await query;
  if (error || !data) return { items: [], nextCursor: null };

  const rows = data as unknown as RawLogRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const items = pageRows.map(toRow);
  const last = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.accessed_at, last.id) : null;

  return { items, nextCursor };
}
