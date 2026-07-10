"use server";

import {
  supportJournalSchema,
  computeServiceHours,
  type SupportJournalInput,
} from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * P1-4 활동지원 일지 (S-01 홈, S-12 작성 5단계, S-13 상세) Server Action 모음.
 *
 * 활동지원사는 대상 당사자(personId)의 DAI 도메인 write/edit 권한 보유자여야 records INSERT가
 * 가능하다(records_insert RLS §4-2). 여기서는 권한을 애플리케이션에서 재검증하지 않고 RLS에
 * 위임한다 — 권한 없으면 INSERT가 RLS로 거부된다.
 *
 * F-S-04 서비스 시간: content.service_hours는 반드시 서버에서 start/end로 재계산해 저장한다
 * (클라이언트가 보낸 값은 신뢰하지 않는다).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SupportJournalResult {
  ok?: boolean;
  error?: string;
  recordId?: string;
}

/** S-13 상세 / S-01 목록 항목 */
export interface SupportJournalSummary {
  id: string;
  personId: string;
  personName: string | null;
  serviceDate: string | null;
  serviceHours: number | null;
  isDraft: boolean;
  recordDate: string;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/**
 * S-12 활동지원 일지 제출. isDraft=true면 임시저장(F-S-05).
 * content에는 서버가 재계산한 service_hours를 포함해 저장한다.
 */
export async function submitSupportJournal(
  personId: string,
  input: SupportJournalInput,
  isDraft = false
): Promise<SupportJournalResult> {
  if (!UUID_RE.test(personId)) {
    return { error: "당사자 정보가 올바르지 않습니다." };
  }

  const parsed = supportJournalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const serviceHours = computeServiceHours(parsed.data.start_time, parsed.data.end_time);
  const content = { ...parsed.data, service_hours: serviceHours };

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
 * F-S-03 이전 일지 참조 — 같은 person_id의 가장 최근 확정(비임시) DAI-002 일지를 반환한다.
 * S-12 작성 화면의 "이전 일지" 패널에서 자동완성 초기값으로 쓴다. 없으면 null.
 * RLS가 접근 권한을 강제하므로 권한 없는 person_id 조회는 자연히 빈 결과가 된다.
 */
export async function getPreviousJournal(
  personId: string
): Promise<{ id: string; content: SupportJournalInput; recordDate: string } | null> {
  if (!UUID_RE.test(personId)) return null;

  const supabase = await createClient();
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

/**
 * S-01 홈 목록 — 본인이 author인 활동지원 일지 목록(대상 당사자 이름 join).
 * 최신순. person join은 persons_select RLS로 접근 가능한 당사자에 한한다.
 */
export async function getSupporterJournals(limit = 20): Promise<SupportJournalSummary[]> {
  const supabase = await createClient();
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
