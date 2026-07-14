"use server";

import {
  guardianRecordSchema,
  recordDisplayTitle,
  GUARDIAN_RECORD_TYPE,
  type GuardianRecordInput,
  type GuardianNote,
  type DomainKey,
} from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";

/**
 * G-20 보호자용 기록 관리(Split Pane 목록+상세) + G-21 기록 작성·수정 Server Action 모음.
 * docs/02-ia.md §3-3 / §3-10, docs/01-prd.md F-G-04(§5-3), docs/05-erd.md §2-6 / §4-2 / §4-6.
 *
 * 접근 통제는 전부 RLS(§4-2)에 위임한다 — guardians 분기는 도메인 조건이 없어 보호자는
 * permissions 부여 여부와 무관하게 모든 도메인 기록을 SELECT/INSERT/UPDATE할 수 있다.
 * 여기서는 새 RLS를 만들지 않으며, 권한 없는 person_id 조회는 자연히 빈 결과가 된다.
 *
 * GEN-001(보호자 범용 기록) vs 구조화 기록 수정:
 *  - 신규 작성분은 record_type='GEN-001', content={title, body}로 저장한다.
 *  - 전문가가 만든 구조화 기록(GEN-001이 아닌 타입) 수정은 content를 통째로 덮어쓰지 않고
 *    content.guardianNote 서브키에 {title, body, editedAt}를 병합해 원본 구조화 필드를 보존한다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

/** G-20 좌측 목록 항목. */
export interface RecordListItem {
  id: string;
  domain: DomainKey;
  recordType: string;
  title: string;
  authorName: string | null;
  recordDate: string;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
  /** 확인 주체 user id(없으면 null). P-10에서 "본인 확인 대상 여부" 판별에 쓴다. */
  confirmerId: string | null;
}

/** G-20 우측 상세. content 원본과 구조화기록 여부를 프론트가 분기할 수 있게 노출한다. */
export interface RecordDetail extends RecordListItem {
  personId: string;
  content: unknown;
  /** true면 GEN-001(보호자 범용) — 프론트는 {title, body}를 그대로 편집 폼에 바인딩한다. */
  isGuardianRecord: boolean;
  /** 구조화 기록에 병합돼 있던 보호자 메모(없으면 null). 프론트 "보호자 메모" 섹션 초기값. */
  guardianNote: GuardianNote | null;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

function pickAuthorName(author: unknown): string | null {
  if (Array.isArray(author)) {
    const first = author[0] as { full_name?: string } | undefined;
    return first?.full_name ?? null;
  }
  const obj = author as { full_name?: string } | null;
  return obj?.full_name ?? null;
}

const LIST_COLUMNS =
  "id, person_id, domain, record_type, content, is_draft, requires_confirmation, confirmer_id, confirmed_at, record_date, author:users!records_author_id_fkey(full_name)";

interface RawRecordRow {
  id: string;
  person_id: string;
  domain: string;
  record_type: string;
  content: unknown;
  is_draft: boolean | null;
  requires_confirmation: boolean | null;
  confirmer_id: string | null;
  confirmed_at: string | null;
  record_date: string;
  author: unknown;
}

function toListItem(row: RawRecordRow): RecordListItem {
  return {
    id: row.id,
    domain: row.domain as DomainKey,
    recordType: row.record_type,
    title: recordDisplayTitle(row.record_type, row.content),
    authorName: pickAuthorName(row.author),
    recordDate: row.record_date,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmedAt: row.confirmed_at,
    confirmerId: row.confirmer_id,
  };
}

/** content.guardianNote가 유효하면 파싱해 반환, 아니면 null. */
function extractGuardianNote(content: unknown): GuardianNote | null {
  const c = content as { guardianNote?: unknown } | null;
  const gn = c?.guardianNote as Partial<GuardianNote> | undefined;
  if (gn && typeof gn.title === "string" && typeof gn.body === "string") {
    return { title: gn.title, body: gn.body, editedAt: gn.editedAt ?? "" };
  }
  return null;
}

/** 미확인 기록을 우선 정렬(docs/02-ia.md §3-3), 그 다음 최신순. */
function sortByConfirmationThenDate(items: RecordListItem[]): RecordListItem[] {
  return [...items].sort((a, b) => {
    const aPending = a.requiresConfirmation && !a.confirmedAt ? 0 : 1;
    const bPending = b.requiresConfirmation && !b.confirmedAt ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return a.recordDate < b.recordDate ? 1 : -1;
  });
}

/**
 * G-20 목록 — 해당 당사자의 모든 도메인·모든 record_type 기록. 미확인 우선, 그 다음 최신순.
 * 접근 가능한 것만 RLS가 반환한다.
 */
export async function getPersonRecords(personId: string): Promise<RecordListItem[]> {
  if (!UUID_RE.test(personId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(LIST_COLUMNS)
    .eq("person_id", personId)
    .order("record_date", { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return sortByConfirmationThenDate((data as unknown as RawRecordRow[]).map(toListItem));
}

/** G-20 상세 — 단일 기록 전체(content 원본 포함). 접근 불가 시 null. */
export async function getRecordDetail(recordId: string): Promise<RecordDetail | null> {
  if (!UUID_RE.test(recordId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(LIST_COLUMNS)
    .eq("id", recordId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as RawRecordRow;
  await logAccess(row.person_id, "view", {
    recordId: row.id,
    domain: row.domain as DomainKey,
  });
  const isGuardianRecord = row.record_type === GUARDIAN_RECORD_TYPE;
  return {
    ...toListItem(row),
    personId: row.person_id,
    content: row.content,
    isGuardianRecord,
    guardianNote: isGuardianRecord ? null : extractGuardianNote(row.content),
  };
}

/**
 * G-21 신규 작성 — record_type='GEN-001', content={title, body}로 INSERT.
 * 보호자 본인 작성분은 확인 절차 대상이 아니다(requires_confirmation=false, §4-6 표).
 * INSERT 권한은 records_insert RLS(guardians 분기, 도메인 조건 없음)가 강제한다.
 */
export async function createGuardianRecord(
  personId: string,
  input: GuardianRecordInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) {
    return { error: "당사자 정보가 올바르지 않습니다." };
  }
  const parsed = guardianRecordSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: parsed.data.domain,
      record_type: GUARDIAN_RECORD_TYPE,
      content: { title: parsed.data.title, body: parsed.data.body },
      is_draft: false,
      requires_confirmation: false,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `기록 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", {
    recordId: row.id as string,
    domain: parsed.data.domain,
  });
  return { ok: true, recordId: row.id as string };
}

/**
 * G-21 수정.
 *  - 대상이 GEN-001이면 content를 {title, body}로 통째로 교체한다.
 *  - 그 외 구조화 기록이면 content.guardianNote 서브키에 비파괴적으로 병합한다(원본 필드 보존).
 * UPDATE 권한은 records_update RLS(guardians 분기, 도메인/컬럼 조건 없음)가 강제한다.
 * 참고: 구조화 기록 병합은 content를 바꾸므로, requires_confirmation=true였다면
 * trg_reset_confirmation_on_edit(§4-6④)가 confirmed_at을 NULL로 되돌려 재확인을 요청한다.
 */
export async function updateGuardianRecord(
  recordId: string,
  input: GuardianRecordInput
): Promise<ActionResult> {
  if (!UUID_RE.test(recordId)) {
    return { error: "기록 정보가 올바르지 않습니다." };
  }
  const parsed = guardianRecordSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();

  const { data: existing, error: selErr } = await supabase
    .from("records")
    .select("id, person_id, domain, record_type, content")
    .eq("id", recordId)
    .maybeSingle();

  if (selErr || !existing) {
    return { error: "기록을 찾을 수 없거나 접근 권한이 없습니다." };
  }

  const recordType = existing.record_type as string;
  let nextContent: Record<string, unknown>;

  if (recordType === GUARDIAN_RECORD_TYPE) {
    nextContent = { title: parsed.data.title, body: parsed.data.body };
  } else {
    const original = (existing.content ?? {}) as Record<string, unknown>;
    const guardianNote: GuardianNote = {
      title: parsed.data.title,
      body: parsed.data.body,
      editedAt: new Date().toISOString(),
    };
    nextContent = { ...original, guardianNote };
  }

  const { error: updErr } = await supabase
    .from("records")
    .update({ content: nextContent, updated_at: new Date().toISOString() })
    .eq("id", recordId);

  if (updErr) return { error: `기록 수정에 실패했습니다: ${updErr.message}` };
  await logAccess(existing.person_id as string, "update", {
    recordId,
    domain: existing.domain as DomainKey,
  });
  return { ok: true };
}

/**
 * G-20 상세 "확인했습니다" — confirmed_at만 now()로 UPDATE(§3-4, §4-6).
 * 확인 주체 검증은 trg_confirmation_owner 트리거(auth.uid()=confirmer_id)가 강제하며,
 * 불일치 시 예외를 던진다 — 이를 잡아 사용자 친화적 메시지로 변환한다.
 * 이번 라운드는 보호자 시나리오(child/youth, confirmer=주보호자)만 보장한다(당사자 본인
 * 확인 경로는 아래 보고 참조).
 */
export async function confirmRecord(recordId: string): Promise<ActionResult> {
  if (!UUID_RE.test(recordId)) {
    return { error: "기록 정보가 올바르지 않습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("records")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", recordId);

  if (error) {
    if (error.message.includes("확인 권한") || error.message.includes("confirmer_id")) {
      return { error: "이 기록의 확인 주체가 아니어서 확인할 수 없습니다." };
    }
    return { error: `확인 처리에 실패했습니다: ${error.message}` };
  }
  return { ok: true };
}
