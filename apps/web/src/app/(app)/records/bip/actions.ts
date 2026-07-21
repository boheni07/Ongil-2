"use server";

import { bipSchema, type BipInput, type BehaviorFunction } from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";
import { computeLifeStage } from "@/lib/lifecycle";
import type { LifeStage } from "@/components/lifecycle/StageBadge";

/**
 * 행동중재계획(BIP, EDU-003) 특수교사(teacher) Server Action 모음 — docs/07 §5 갭③.
 * `/records/bip/new` 작성 위저드·목록·조회를 지원한다.
 * docs/05-erd.md §3(EDU-003)·§4-2·§4-6①, docs/01-prd.md §3-2-1(역할×기록유형 매트릭스).
 *
 * IEP 스위트(records/iep/actions.ts)와 동일 구조를 EDU-003에 이식했다. "담당 학생"은 이 교사가
 * EDU 도메인에 활성 write/edit 권한을 가진 persons로 좁힌다(전환계획/TRA 스코핑과 동일 결정).
 * 접근 통제 자체는 전부 기존 RLS(§4-2)에 위임한다 — 아래 목록 쿼리는 UX용 사전 필터일 뿐이며,
 * DB 최종 방어선은 records_insert RLS(permissions EDU write/edit 분기)다.
 *
 * BIP는 IEP·ISP·치료계획서와 동급의 공식 지원계획 문서라 requires_confirmation=true(§4-6①) —
 * 제출(is_draft=false) 시 trg_assign_confirmer가 확인 주체(성년=본인, 미성년=주보호자)를 자동
 * 지정한다(앱 코드는 confirmer_id/confirmed_at을 직접 다루지 않는다).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

/** 작성 대상 학생 카드(EDU write/edit 권한 보유자). */
export interface BipClient {
  personId: string;
  fullName: string;
  birthDate: string;
  avatarUrl: string | null;
  lifeStage: LifeStage;
  /** 가장 최근 제출된 BIP(EDU-003) 요약. 없으면 null("새 BIP 작성"으로 유도). */
  latestBip: {
    id: string;
    behaviorFunction: BehaviorFunction | null;
    reviewDate: string | null;
    requiresConfirmation: boolean;
    confirmedAt: string | null;
  } | null;
}

/** 목록 항목. */
export interface BipRecordSummary {
  recordId: string;
  personId: string;
  targetBehavior: string;
  behaviorFunction: BehaviorFunction | null;
  reviewDate: string | null;
  recordDate: string;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
}

/** getBipDetail 상세 반환. */
export interface BipDetail {
  recordId: string;
  personId: string;
  content: BipInput;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmerId: string | null;
  confirmedAt: string | null;
  recordDate: string;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/** content에서 behavior_function을 안전하게 추출한다. */
function bipBehaviorFunction(content: unknown): BehaviorFunction | null {
  const c = content as { behavior_function?: unknown } | null;
  const f = c?.behavior_function;
  return f === "attention" || f === "escape" || f === "sensory" || f === "other" ? f : null;
}

function bipReviewDate(content: unknown): string | null {
  const c = content as { review_date?: unknown } | null;
  return typeof c?.review_date === "string" ? c.review_date : null;
}

function bipTargetBehavior(content: unknown): string {
  const c = content as { target_behavior?: unknown } | null;
  return typeof c?.target_behavior === "string" ? c.target_behavior : "";
}

interface RawBipRow {
  id: string;
  person_id: string;
  content: unknown;
  is_draft: boolean | null;
  requires_confirmation: boolean | null;
  confirmed_at: string | null;
  record_date: string;
}

/**
 * 작성 대상 학생 목록 — 이 교사가 EDU 도메인에 활성 write/edit 권한을 가진 persons.
 * 각 학생의 최근 제출 BIP(EDU-003)에서 행동 기능·재검토일·확인 상태를 파생한다.
 * life_stage는 클라이언트 헬퍼(computeLifeStage)로 통일한다(IEP/ISP/TRA 라운드와 동일 결정).
 */
export async function getBipClients(): Promise<BipClient[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [permsRes, guardianRes] = await Promise.all([
    supabase
      .from("permissions")
      .select("person_id")
      .eq("grantee_id", user.id)
      .eq("is_active", true)
      .eq("domain", "EDU")
      .in("access_level", ["write", "edit"]),
    supabase.from("guardians").select("person_id").eq("user_id", user.id),
  ]);
  // 보호자는 도메인 제한 없이 모든 기록을 직접 작성할 수 있다(2026-07-19 — 구조화 기록도
  // 각 분야 전용 입력폼으로 쓰고 싶다는 피드백에 따라 담당(permissions) 목록에 병합).
  const personIds = [
    ...new Set([
      ...(permsRes.data ?? []).map((p) => p.person_id as string),
      ...(guardianRes.data ?? []).map((g) => g.person_id as string),
    ]),
  ];
  if (personIds.length === 0) return [];

  const [personsRes, bipRes] = await Promise.all([
    supabase.from("persons").select("id, full_name, birth_date, avatar_url").in("id", personIds),
    supabase
      .from("records")
      .select("id, person_id, content, requires_confirmation, confirmed_at, record_date")
      .in("person_id", personIds)
      .eq("record_type", "EDU-003")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
  ]);

  const persons = personsRes.data ?? [];
  const bips = (bipRes.data ?? []) as RawBipRow[];

  // person_id별 가장 최근 EDU-003 하나만 남긴다(정렬이 내림차순이라 첫 등장이 최신).
  const latestByPerson = new Map<string, RawBipRow>();
  for (const row of bips) {
    if (!latestByPerson.has(row.person_id)) latestByPerson.set(row.person_id, row);
  }

  return persons.map((p) => {
    const bip = latestByPerson.get(p.id as string) ?? null;
    return {
      personId: p.id as string,
      fullName: (p.full_name as string) ?? "",
      birthDate: p.birth_date as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      lifeStage: computeLifeStage(p.birth_date as string),
      latestBip: bip
        ? {
            id: bip.id,
            behaviorFunction: bipBehaviorFunction(bip.content),
            reviewDate: bipReviewDate(bip.content),
            requiresConfirmation: Boolean(bip.requires_confirmation),
            confirmedAt: bip.confirmed_at,
          }
        : null,
    };
  });
}

/**
 * BIP 작성 — records INSERT(domain='EDU', record_type='EDU-003').
 * 공식 지원계획 문서라 requires_confirmation=true(§4-6①) — 제출(is_draft=false) 시
 * trg_assign_confirmer가 확인 주체를 자동 지정한다. INSERT 권한은 records_insert RLS
 * (permissions EDU write/edit 분기)가 강제한다.
 */
export async function createBip(
  personId: string,
  input: BipInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "학생 정보가 올바르지 않습니다." };

  const parsed = bipSchema.safeParse(input);
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
      domain: "EDU",
      record_type: "EDU-003",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: true,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `행동중재계획 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "EDU" });
  return { ok: true, recordId: row.id as string };
}

/**
 * 해당 학생의 BIP(EDU-003) 목록 요약을 최신순으로. 접근 가능한 것만 RLS가 반환한다.
 */
export async function listBipRecords(personId: string): Promise<BipRecordSummary[]> {
  if (!UUID_RE.test(personId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select("id, person_id, content, is_draft, requires_confirmation, confirmed_at, record_date")
    .eq("person_id", personId)
    .eq("record_type", "EDU-003")
    .order("record_date", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as RawBipRow[]).map((row) => ({
    recordId: row.id,
    personId: row.person_id,
    targetBehavior: bipTargetBehavior(row.content),
    behaviorFunction: bipBehaviorFunction(row.content),
    reviewDate: bipReviewDate(row.content),
    recordDate: row.record_date,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmedAt: row.confirmed_at,
  }));
}

interface RawBipDetailRow extends RawBipRow {
  confirmer_id: string | null;
}

/**
 * BIP 상세 — content 전체 + 확인 상태. 접근 불가 시 null.
 * 목록/타임라인 제목은 RECORD_TYPE_LABEL["EDU-003"]="행동중재계획(BIP)"로 표시된다.
 */
export async function getBipDetail(recordId: string): Promise<BipDetail | null> {
  if (!UUID_RE.test(recordId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(
      "id, person_id, content, is_draft, requires_confirmation, confirmer_id, confirmed_at, record_date"
    )
    .eq("id", recordId)
    .eq("record_type", "EDU-003")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RawBipDetailRow;

  await logAccess(row.person_id, "view", { recordId: row.id, domain: "EDU" });

  return {
    recordId: row.id,
    personId: row.person_id,
    content: row.content as BipInput,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmerId: row.confirmer_id,
    confirmedAt: row.confirmed_at,
    recordDate: row.record_date,
  };
}
