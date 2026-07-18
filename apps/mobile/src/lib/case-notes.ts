import {
  caseConferenceNoteSchema,
  RECORD_TYPE_LABEL,
  type CaseConferenceNoteInput,
  type DomainKey,
} from "@ongil/validation";
import { supabase } from "./supabase";
import { computeLifeStage, type LifeStage } from "./iep";

/**
 * W-22/23 사례회의록(WEL-006) 사회복지사(social_worker) 데이터 접근(모바일).
 * 웹 Server Action(apps/web/src/app/(app)/records/case-notes/actions.ts)의 로직을
 * Supabase 직접 호출로 동일하게 재현한다. DB 계약(테이블·컬럼·record_type 값·
 * requires_confirmation 규칙)은 웹과 1:1 대응하며 임의로 바꾸지 않는다.
 *
 * "담당 당사자"는 이 사회복지사가 WEL 도메인에 활성 write/edit 권한을 가진 persons로 좁힌다
 * (ISP/전환계획 스코핑과 동일 결정). 접근 통제 자체는 전부 기존 RLS(§4-2)에 위임하며
 * 목록 쿼리는 UX용 사전 필터다.
 *
 * WEL-006은 일상 기록이라 requires_confirmation=false(§4-6) — 저장 시 확인 절차가 아니라
 * 당사자·보호자에게 일반 알림(record_new)만 best-effort로 발송한다(웹 notifyRecipients와 동형).
 * 모바일엔 공통 알림 유틸이 없어 여기서 인라인 try/catch로 직접 insert한다(handover.ts와 동일 관행).
 * logAccess는 iep.ts의 것이 export되지 않아 여기서도 재정의한다(transition.ts/bip.ts와 동일 판단).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * G-40 접근 로그 기록(모바일) — access_logs INSERT(§4-4). next/headers(IP·UA)가 없어
 * ip_address/user_agent는 null. 감사 로그는 best-effort라 실패해도 작업을 막지 않는다.
 */
type AccessLogAction = "view" | "create" | "update" | "export";

async function logAccess(
  personId: string,
  action: AccessLogAction,
  opts?: { recordId?: string; domain?: DomainKey }
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("access_logs").insert({
      actor_id: user.id,
      person_id: personId,
      record_id: opts?.recordId ?? null,
      action,
      domain: opts?.domain ?? null,
      ip_address: null,
      user_agent: null,
    });
  } catch {
    // 감사 로그 실패는 사용자 작업을 막지 않는다 — 조용히 무시.
  }
}

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

/** 담당 당사자 카드(WEL write/edit 권한 보유자). */
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
 * 담당 당사자 목록 — 이 사회복지사가 WEL 도메인에 활성 write/edit 권한을 가진 persons.
 * 각 당사자의 사례회의록 건수를 파생한다.
 */
export async function getCaseNoteClients(): Promise<CaseNoteClient[]> {
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
 * 해당 당사자의 사례회의록 목록을 최신순으로 반환한다. 접근 가능한 record만 RLS(§4-2)가 반환한다.
 */
export async function listCaseNotes(personId: string): Promise<CaseNoteSummary[]> {
  if (!UUID_RE.test(personId)) return [];

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
 * 일상 기록이라 requires_confirmation=false(§4-6) — 확인 절차 없이 저장되며, 당사자·보호자에게
 * 일반 알림(record_new)만 best-effort로 발송한다. INSERT 권한은 records_insert RLS(도메인 단위).
 */
export async function createCaseConferenceNote(
  personId: string,
  input: CaseConferenceNoteInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = caseConferenceNoteSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

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
  try {
    const { data: guardianRows } = await supabase
      .from("guardians")
      .select("user_id")
      .eq("person_id", personId);
    const recipientIds = new Set<string>((guardianRows ?? []).map((g) => g.user_id as string));
    recipientIds.add(personId); // 셀프 가입 모델: person 역할 계정은 id=person_id
    recipientIds.delete(user.id);

    if (recipientIds.size > 0) {
      await supabase.from("notifications").insert(
        [...recipientIds].map((rid) => ({
          recipient_id: rid,
          type: "record_new",
          title: "새 사례회의록",
          body: `${RECORD_TYPE_LABEL["WEL-006"]}이 등록되었습니다.`,
          data: { record_id: recordId, person_id: personId, record_type: "WEL-006" },
        }))
      );
    }
  } catch {
    // 알림 실패는 무시(부가 기능).
  }

  await logAccess(personId, "create", { recordId, domain: "WEL" });
  return { ok: true, recordId };
}
