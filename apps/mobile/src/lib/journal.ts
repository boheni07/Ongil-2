import {
  computeServiceHours,
  supportJournalSchema,
  type SupportJournalInput,
} from "@ongil/validation";
import { supabase } from "./supabase";

/**
 * P1-4 활동지원 일지 (S-01 홈, S-12 작성, S-13 상세) 데이터 접근.
 * 웹 Server Action(apps/web/src/app/(app)/journal/actions.ts)과 동일한 로직을
 * Supabase 직접 호출로 재현한다. service_hours는 서버와 동일하게 computeServiceHours로
 * 재계산해 content에 포함한다(F-S-04 — 클라이언트 입력값 신뢰하지 않음).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SupportJournalResult {
  ok?: boolean;
  error?: string;
  recordId?: string;
}

export interface SupportJournalSummary {
  id: string;
  personId: string;
  personName: string | null;
  serviceDate: string | null;
  serviceHours: number | null;
  isDraft: boolean;
  recordDate: string;
}

export interface SupportJournalDetail {
  id: string;
  personId: string;
  personName: string | null;
  content: SupportJournalInput & { service_hours?: number };
  isDraft: boolean;
  recordDate: string;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/**
 * S-12 제출. isDraft=true면 임시저장(F-S-05). service_hours는 서버 재계산값 저장.
 *
 * `existingRecordId`가 있으면 새로 INSERT하지 않고 그 기록을 UPDATE한다 — "임시저장한 일지를
 * 선택해 이어서 작성"(S-14) 흐름에서 쓴다(웹 journal/actions.ts submitSupportJournal와 동형).
 * records_update RLS(20260721000000_p3_records_update_own_draft_rls)가 "본인이 작성자이고
 * 아직 is_draft=true인 기록"을 도메인 접근수준과 무관하게 UPDATE 허용한다 — 이미 확정 제출된
 * 기록은 이 경로로 다시 수정할 수 없다(UPDATE 0행 매치로 실패 처리됨).
 */
export async function submitSupportJournal(
  personId: string,
  input: SupportJournalInput,
  isDraft = false,
  existingRecordId?: string
): Promise<SupportJournalResult> {
  if (!UUID_RE.test(personId)) {
    return { error: "당사자 정보가 올바르지 않습니다." };
  }
  if (existingRecordId && !UUID_RE.test(existingRecordId)) {
    return { error: "기록 정보가 올바르지 않습니다." };
  }

  const parsed = supportJournalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const serviceHours = computeServiceHours(parsed.data.start_time, parsed.data.end_time);
  const content = { ...parsed.data, service_hours: serviceHours };

  if (existingRecordId) {
    const { data: row, error: updErr } = await supabase
      .from("records")
      .update({
        content,
        is_draft: isDraft,
        record_date: parsed.data.service_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingRecordId)
      .eq("record_type", "DAI-002")
      .select("id")
      .single();

    if (updErr || !row) {
      return {
        error: `일지 저장에 실패했습니다: ${updErr?.message ?? "이미 제출된 일지는 이어서 작성할 수 없습니다."}`,
      };
    }
    return { ok: true, recordId: row.id as string };
  }

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: "DAI",
      record_type: "DAI-002",
      content,
      is_draft: isDraft,
      requires_confirmation: false,
      record_date: parsed.data.service_date,
    })
    .select("id")
    .single();

  if (insErr) {
    return { error: `일지 저장에 실패했습니다: ${insErr.message}` };
  }
  return { ok: true, recordId: row.id as string };
}

/**
 * S-14 "임시저장된 일지 이어서 작성" — draft 하나를 personId·content까지 온전히 가져온다.
 * is_draft=false(이미 확정 제출)면 null을 반환해 호출부가 편집 대신 상세로 보내게 한다(웹과 동형).
 */
export async function getJournalDraft(
  recordId: string
): Promise<{ id: string; personId: string; content: SupportJournalInput } | null> {
  if (!UUID_RE.test(recordId)) return null;

  const { data, error } = await supabase
    .from("records")
    .select("id, person_id, content, is_draft")
    .eq("id", recordId)
    .eq("record_type", "DAI-002")
    .maybeSingle();

  if (error || !data || !data.is_draft) return null;
  return {
    id: data.id as string,
    personId: data.person_id as string,
    content: data.content as SupportJournalInput,
  };
}

/** S-12 이용자 선택 — RLS로 접근 가능한(권한 보유) 당사자 목록. */
export async function getServiceablePersons(): Promise<{ id: string; fullName: string }[]> {
  const { data, error } = await supabase
    .from("persons")
    .select("id, full_name")
    .order("full_name", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({ id: row.id as string, fullName: row.full_name as string }));
}

/** F-S-03 이전 일지 참조 — 같은 person_id의 가장 최근 확정 DAI-002 일지. 없으면 null. */
export async function getPreviousJournal(
  personId: string
): Promise<{ id: string; content: SupportJournalInput; recordDate: string } | null> {
  if (!UUID_RE.test(personId)) return null;

  const { data, error } = await supabase
    .from("records")
    .select("id, content, record_date")
    .eq("person_id", personId)
    .eq("record_type", "DAI-002")
    .eq("is_draft", false)
    .order("record_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    content: data.content as SupportJournalInput,
    recordDate: data.record_date as string,
  };
}

/** S-01 홈 목록 — 본인이 author인 활동지원 일지(대상 당사자 이름 join). 최신순. */
export async function getSupporterJournals(limit = 20): Promise<SupportJournalSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("records")
    .select("id, person_id, content, is_draft, record_date, person:persons(full_name)")
    .eq("author_id", user.id)
    .eq("record_type", "DAI-002")
    .order("record_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => {
    const person = row.person as { full_name: string } | { full_name: string }[] | null;
    const personName = Array.isArray(person)
      ? (person[0]?.full_name ?? null)
      : (person?.full_name ?? null);
    const content = row.content as Partial<SupportJournalInput> & { service_hours?: number };
    return {
      id: row.id as string,
      personId: row.person_id as string,
      personName,
      serviceDate: content?.service_date ?? null,
      serviceHours: content?.service_hours ?? null,
      isDraft: Boolean(row.is_draft),
      recordDate: row.record_date as string,
    };
  });
}

/** S-13 상세 — 단일 일지 전체 content. RLS로 접근 가능한 것만 반환. */
export async function getJournalDetail(id: string): Promise<SupportJournalDetail | null> {
  if (!UUID_RE.test(id)) return null;

  const { data, error } = await supabase
    .from("records")
    .select("id, person_id, content, is_draft, record_date, person:persons(full_name)")
    .eq("id", id)
    .eq("record_type", "DAI-002")
    .maybeSingle();

  if (error || !data) return null;

  const person = data.person as { full_name: string } | { full_name: string }[] | null;
  const personName = Array.isArray(person)
    ? (person[0]?.full_name ?? null)
    : (person?.full_name ?? null);

  return {
    id: data.id as string,
    personId: data.person_id as string,
    personName,
    content: data.content as SupportJournalInput & { service_hours?: number },
    isDraft: Boolean(data.is_draft),
    recordDate: data.record_date as string,
  };
}
