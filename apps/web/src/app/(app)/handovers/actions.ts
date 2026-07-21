"use server";

import { handoverNoteSchema, type HandoverNoteInput } from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { notifyRecipients } from "@/lib/notify";

/**
 * S-20(인계인수 목록)/S-21(인계인수 작성) Server Action 모음.
 * docs/04-workflow.md Flow-S-02, docs/01-prd.md F-S-02.
 *
 * 인계인수 접근 제어(누가 어떤 person의 인계를 보고/쓸 수 있는지)는 handover_notes RLS(§4)에
 * 위임한다 — 여기서 permissions를 재검증하지 않는다. 단 getHandoverTargets는 RLS로 자동
 * 필터되지 않는 조회(다른 유저 후보 목록)이므로 person_id·domain 필터를 명시적으로 건다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

export interface HandoverResult {
  ok?: boolean;
  error?: string;
  handoverId?: string;
}

/** S-20 목록 항목(받은/보낸 공용). */
export interface HandoverSummary {
  id: string;
  personId: string;
  personName: string | null;
  fromUserId: string | null;
  fromUserName: string | null;
  toUserId: string | null;
  toUserName: string | null;
  content: string;
  priority: string;
  acknowledgedAt: string | null;
  createdAt: string;
}

/** S-21 작성 폼 "대상 지원사 선택" 드롭다운 항목. */
export interface HandoverTarget {
  userId: string;
  fullName: string | null;
}

function pickName(rel: unknown): string | null {
  const r = rel as { full_name?: string } | { full_name?: string }[] | null;
  if (Array.isArray(r)) return r[0]?.full_name ?? null;
  return r?.full_name ?? null;
}

/**
 * S-20 [받은 인계] 탭 — 로그인 유저가 to_user_id인 인계 목록.
 * 정렬: 미확인(acknowledged_at NULL) 우선, 그 다음 최신순.
 * person/from_user 이름 join은 RLS로 접근 가능한 범위에 한한다.
 */
export async function getReceivedHandovers(limit = 30): Promise<HandoverSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("handover_notes")
    .select(
      "id, person_id, from_user_id, to_user_id, content, priority, acknowledged_at, created_at, person:persons(full_name), fromUser:users!from_user_id(full_name)"
    )
    .eq("to_user_id", user.id)
    .order("acknowledged_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    personId: row.person_id as string,
    personName: pickName(row.person),
    fromUserId: (row.from_user_id as string | null) ?? null,
    fromUserName: pickName(row.fromUser),
    toUserId: (row.to_user_id as string | null) ?? null,
    toUserName: null,
    content: row.content as string,
    priority: row.priority as string,
    acknowledgedAt: (row.acknowledged_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

/**
 * S-20 [보낸 인계] 탭 — 로그인 유저가 from_user_id인 인계 목록, 최신순.
 */
export async function getSentHandovers(limit = 30): Promise<HandoverSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("handover_notes")
    .select(
      "id, person_id, from_user_id, to_user_id, content, priority, acknowledged_at, created_at, person:persons(full_name), toUser:users!to_user_id(full_name)"
    )
    .eq("from_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    personId: row.person_id as string,
    personName: pickName(row.person),
    fromUserId: (row.from_user_id as string | null) ?? null,
    fromUserName: null,
    toUserId: (row.to_user_id as string | null) ?? null,
    toUserName: pickName(row.toUser),
    content: row.content as string,
    priority: row.priority as string,
    acknowledgedAt: (row.acknowledged_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

/**
 * S-21 작성 폼 "대상 지원사 선택" — 해당 person에 DAI write/edit 활성 권한을 가진
 * 본인 제외 다른 유저(다음 지원사 후보) 목록.
 * RLS로 자동 필터되지 않는 조회이므로 person_id·domain·유효기간 필터를 명시적으로 건다.
 */
export async function getHandoverTargets(personId: string): Promise<HandoverTarget[]> {
  if (!UUID_RE.test(personId)) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("permissions")
    .select("grantee_id, grantee:users!grantee_id(full_name)")
    .eq("person_id", personId)
    .eq("domain", "DAI")
    .eq("is_active", true)
    .in("access_level", ["write", "edit"])
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .neq("grantee_id", user.id);

  if (error || !data) return [];

  // 같은 유저가 여러 권한 행을 가질 수 있으므로 grantee_id로 중복 제거.
  const seen = new Map<string, HandoverTarget>();
  for (const row of data) {
    const userId = row.grantee_id as string;
    if (!seen.has(userId)) {
      seen.set(userId, { userId, fullName: pickName(row.grantee) });
    }
  }
  return Array.from(seen.values());
}

/**
 * S-21 인계인수 작성 — handover_notes INSERT 후 대상 지원사에게 notifications INSERT(best-effort).
 * from_user_id=로그인 유저. 접근 권한(대상 person에 대한 인계 작성 자격)은 handover_notes RLS에 위임.
 * 알림 INSERT는 부가 기능이라 실패해도 인계 저장을 롤백하지 않는다(try/catch로 무시).
 */
export async function createHandover(
  personId: string,
  input: HandoverNoteInput
): Promise<HandoverResult> {
  if (!UUID_RE.test(personId)) {
    return { error: "당사자 정보가 올바르지 않습니다." };
  }

  const parsed = handoverNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: row, error: insErr } = await supabase
    .from("handover_notes")
    .insert({
      person_id: personId,
      from_user_id: user.id,
      to_user_id: parsed.data.toUserId,
      content: parsed.data.content,
      priority: parsed.data.priority,
    })
    .select("id")
    .single();

  if (insErr) {
    return { error: `인계인수 저장에 실패했습니다: ${insErr.message}` };
  }

  const handoverId = row.id as string;

  // 다음 지원사에게 인계 알림 — best-effort. 실패해도 인계 저장은 유지한다.
  const { data: me } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const fromName = (me?.full_name as string | undefined) ?? "담당자";
  await notifyRecipients([parsed.data.toUserId], {
    type: "handover",
    title: "새 인계인수",
    body: `${fromName}님이 인계인수를 남겼습니다.`,
    data: { handover_id: handoverId, person_id: personId },
  });

  return { ok: true, handoverId };
}

/**
 * S-20 [받은 인계] "확인했습니다" CTA — acknowledged_at 기록.
 * 아직 미확인(acknowledged_at IS NULL)인 본인 수신 건만 갱신한다.
 * to_user_id 본인 한정·acknowledged_at 컬럼 단위 UPDATE 허용은 RLS(§4)가 강제하므로
 * 여기서는 그 경계를 신뢰하고 얇게 작성한다. 이미 확인된 건 재호출은 idempotent(ok:true).
 */
export async function acknowledgeHandover(id: string): Promise<HandoverResult> {
  if (!UUID_RE.test(id)) {
    return { error: "인계인수 정보가 올바르지 않습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error: updErr } = await supabase
    .from("handover_notes")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("to_user_id", user.id)
    .is("acknowledged_at", null);

  if (updErr) {
    return { error: `확인 처리에 실패했습니다: ${updErr.message}` };
  }
  // 이미 확인된 건이면 0행 갱신 — 에러 아님(idempotent).
  return { ok: true, handoverId: id };
}
