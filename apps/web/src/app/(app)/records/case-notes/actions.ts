"use server";

import {
  caseConferenceNoteSchema,
  RECORD_TYPE_LABEL,
  type CaseConferenceNoteInput,
} from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";
import { notifyRecipients } from "@/lib/notify";
import { computeLifeStage } from "@/lib/lifecycle";
import type { LifeStage } from "@/components/lifecycle/StageBadge";

/**
 * W-22/23 사례회의록(WEL-006) Server Action 모음 — 사회복지사(social_worker) 전용.
 * docs/05-erd.md §3(WEL-006 신설)·§4-2, docs/08-record-taxonomy-workshop.md 안건2-3(워크숍 채택).
 *
 * ISP/전환계획 스위트(records/isp·transition/actions.ts)와 동일 구조 — 접근 통제는 전부 기존
 * RLS(§4-2, WEL 도메인 단위)에 위임한다. requires_confirmation=false(일상 기록, §4-6) — 저장 시
 * 확인 절차가 아니라 당사자·보호자에게 일반 알림(record_new)만 best-effort로 발송한다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

/** `/records/case-notes` 담당 당사자 카드(WEL write/edit 권한 보유자). */
export interface CaseNoteClient {
  personId: string;
  fullName: string;
  birthDate: string;
  lifeStage: LifeStage;
  caseNoteCount: number;
}

/** listCaseNotes 목록 행. */
export interface CaseNoteSummary {
  recordId: string;
  personId: string;
  meetingDate: string;
  participants: string[];
  discussion: string;
  decisions: string | null;
  recordDate: string;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

interface RawCaseNoteRow {
  id: string;
  person_id: string;
  content: unknown;
  record_date: string;
}

/**
 * `/records/case-notes` 담당 당사자 목록 — 이 사회복지사가 WEL 도메인에 활성 write/edit
 * 권한을 가진 persons(ISP·서비스이용계획과 동일 담당 범위). 각 당사자의 사례회의록 건수를 파생한다.
 */
export async function getCaseNoteClients(): Promise<CaseNoteClient[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: perms } = await supabase
    .from("permissions")
    .select("person_id")
    .eq("grantee_id", user.id)
    .eq("is_active", true)
    .eq("domain", "WEL")
    .in("access_level", ["write", "edit"]);
  if (!perms || perms.length === 0) return [];

  const personIds = [...new Set(perms.map((p) => p.person_id as string))];

  const [personsRes, notesRes] = await Promise.all([
    supabase.from("persons").select("id, full_name, birth_date").in("id", personIds),
    supabase
      .from("records")
      .select("person_id")
      .in("person_id", personIds)
      .eq("domain", "WEL")
      .eq("record_type", "WEL-006"),
  ]);

  const persons = personsRes.data ?? [];
  const notes = notesRes.data ?? [];

  const countByPerson = new Map<string, number>();
  for (const row of notes) {
    countByPerson.set(
      row.person_id as string,
      (countByPerson.get(row.person_id as string) ?? 0) + 1
    );
  }

  return persons.map((p) => ({
    personId: p.id as string,
    fullName: (p.full_name as string) ?? "",
    birthDate: p.birth_date as string,
    lifeStage: computeLifeStage(p.birth_date as string),
    caseNoteCount: countByPerson.get(p.id as string) ?? 0,
  }));
}

/**
 * 해당 당사자의 사례회의록 목록을 최신순으로 반환한다.
 * 접근 가능한 record만 RLS(§4-2)가 반환한다(권한 없는 당사자면 빈 배열).
 */
export async function listCaseNotes(personId: string): Promise<CaseNoteSummary[]> {
  if (!UUID_RE.test(personId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select("id, person_id, content, record_date")
    .eq("person_id", personId)
    .eq("domain", "WEL")
    .eq("record_type", "WEL-006")
    .order("record_date", { ascending: false });

  if (error || !data) return [];

  await logAccess(personId, "view", { domain: "WEL" });

  return (data as RawCaseNoteRow[]).map((r) => {
    const c = r.content as CaseConferenceNoteInput;
    return {
      recordId: r.id,
      personId: r.person_id,
      meetingDate: c.meetingDate,
      participants: c.participants ?? [],
      discussion: c.discussion,
      decisions: c.decisions ?? null,
      recordDate: r.record_date,
    };
  });
}

/**
 * 사례회의록(WEL-006) 작성 — records INSERT(domain='WEL', record_type='WEL-006').
 * 일상 기록이라 requires_confirmation=false(§4-6, 관찰기록·권익옹호 상담기록과 동급) — 확인
 * 절차 없이 저장되며, 당사자·보호자에게 일반 알림(record_new)만 best-effort로 발송한다.
 * 작성 게이트: WEL write/edit 권한. DB 최종 방어선은 records_insert RLS(도메인 단위).
 */
export async function createCaseConferenceNote(
  personId: string,
  input: CaseConferenceNoteInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = caseConferenceNoteSchema.safeParse(input);
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
      domain: "WEL",
      record_type: "WEL-006",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: false,
      record_date: parsed.data.meetingDate,
    })
    .select("id")
    .single();

  if (insErr) return { error: `사례회의록 저장에 실패했습니다: ${insErr.message}` };

  const recordId = row.id as string;

  // 당사자·보호자에게 일반 알림만 발송(확인 절차 아님) — best-effort, 실패해도 저장은 유지.
  const { data: guardianRows } = await supabase
    .from("guardians")
    .select("user_id")
    .eq("person_id", personId);
  const recipientIds = new Set<string>((guardianRows ?? []).map((g) => g.user_id as string));
  recipientIds.add(personId); // 셀프 가입 모델: person 역할 계정은 id=person_id
  recipientIds.delete(user.id);

  await notifyRecipients(recipientIds, {
    type: "record_new",
    title: "새 사례회의록",
    body: `${RECORD_TYPE_LABEL["WEL-006"]}이 등록되었습니다.`,
    data: { record_id: recordId, person_id: personId, record_type: "WEL-006" },
  });

  await logAccess(personId, "create", { recordId, domain: "WEL" });
  return { ok: true, recordId };
}
