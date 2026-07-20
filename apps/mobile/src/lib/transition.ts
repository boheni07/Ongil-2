import {
  transitionPlanSchema,
  type TransitionPlanInput,
  type RoadmapStage,
  type DomainKey,
} from "@ongil/validation";
import { supabase } from "./supabase";
import { computeLifeStage, isPreTransitionStage, type LifeStage } from "./iep";

/**
 * W-16 전환계획(TRA-001) 사회복지사 데이터 접근(모바일).
 * 웹 Server Action(apps/web/src/app/(app)/records/transition/actions.ts)의 로직을
 * Supabase 직접 호출로 동일하게 재현한다. DB 계약(테이블·컬럼·record_type 값·
 * requires_confirmation 규칙·만 13세 진입 가드)은 웹과 1:1 대응하며 임의로 바꾸지 않는다.
 *
 * "담당 당사자"는 이 사회복지사가 TRA 도메인에 활성 write/edit 권한을 가진 persons로 좁힌다
 * (lib/isp.ts가 도메인 무관인 것과 달리 전환계획은 TRA 권한 보유자만 작성).
 * 접근 통제 자체는 전부 기존 RLS(§4-2)에 위임하며 목록 쿼리는 UX용 사전 필터다.
 * logAccess는 iep.ts의 것이 export되지 않아 여기서도 재정의한다(isp.ts와 동일 판단).
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

/** W-16 담당 당사자 카드(TRA write/edit 권한 보유자). */
export interface TransitionClient {
  personId: string;
  fullName: string;
  birthDate: string;
  lifeStage: LifeStage;
  /** 해당 person의 가장 최근 TRA-001 요약. 없으면 null. */
  latestPlan: {
    id: string;
    roadmapStage: RoadmapStage | null;
    requiresConfirmation: boolean;
    confirmedAt: string | null;
    /** docs/14 워크숍 — 홈 "이번 주 처리할 일" 카드용 다음 검토일(웹 동형). */
    nextReviewDate: string | null;
  } | null;
}

/** getLatestTransitionPlan 상세 반환. */
export interface TransitionPlanDetail {
  recordId: string;
  personId: string;
  content: TransitionPlanInput;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmerId: string | null;
  confirmedAt: string | null;
  recordDate: string;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/** content에서 roadmap_stage를 안전하게 추출한다. */
function planRoadmapStage(content: unknown): RoadmapStage | null {
  const c = content as { roadmap_stage?: unknown } | null;
  const s = c?.roadmap_stage;
  return s === "exploration" || s === "planning" || s === "training" || s === "employment"
    ? s
    : null;
}

function planNextReviewDate(content: unknown): string | null {
  const c = content as { next_review_date?: unknown } | null;
  return typeof c?.next_review_date === "string" ? c.next_review_date : null;
}

interface RawPlanRow {
  id: string;
  person_id: string;
  content: unknown;
  requires_confirmation: boolean | null;
  confirmed_at: string | null;
  record_date: string;
}

/**
 * W-16 담당 당사자 목록 — 이 사회복지사가 TRA 도메인에 활성 write/edit 권한을 가진 persons.
 * 각 당사자의 최근 제출 TRA-001에서 로드맵 단계·확인 상태를 파생한다.
 */
export async function getTransitionPlanClients(): Promise<TransitionClient[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: perms } = await supabase
    .from("permissions")
    .select("person_id")
    .eq("grantee_id", user.id)
    .eq("is_active", true)
    .eq("domain", "TRA")
    .in("access_level", ["write", "edit"]);
  if (!perms || perms.length === 0) return [];

  const personIds = [...new Set(perms.map((p) => p.person_id as string))];

  const [personsRes, planRes] = await Promise.all([
    supabase.from("persons").select("id, full_name, birth_date").in("id", personIds),
    supabase
      .from("records")
      .select("id, person_id, content, requires_confirmation, confirmed_at, record_date")
      .in("person_id", personIds)
      .eq("record_type", "TRA-001")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
  ]);

  const persons = personsRes.data ?? [];
  const plans = (planRes.data ?? []) as RawPlanRow[];

  // person_id별 가장 최근 TRA-001 하나만 남긴다(정렬이 내림차순이라 첫 등장이 최신).
  const latestByPerson = new Map<string, RawPlanRow>();
  for (const row of plans) {
    if (!latestByPerson.has(row.person_id)) latestByPerson.set(row.person_id, row);
  }

  return persons.map((p) => {
    const plan = latestByPerson.get(p.id as string) ?? null;
    return {
      personId: p.id as string,
      fullName: (p.full_name as string) ?? "",
      birthDate: p.birth_date as string,
      lifeStage: computeLifeStage(p.birth_date as string),
      latestPlan: plan
        ? {
            id: plan.id,
            roadmapStage: planRoadmapStage(plan.content),
            requiresConfirmation: Boolean(plan.requires_confirmation),
            confirmedAt: plan.confirmed_at,
            nextReviewDate: planNextReviewDate(plan.content),
          }
        : null,
    };
  });
}

/**
 * W-16 전환계획 작성 — records INSERT(domain='TRA', record_type='TRA-001').
 * 만 13세+ 진입 가드를 서버에서 재검증한다(life_stage가 영유아기·아동기면 거부).
 * 공식 문서라 requires_confirmation=true(§4-6) — 제출 시 trg_assign_confirmer가 확인 주체를
 * 자동 지정한다(앱 코드는 confirmer_id/confirmed_at을 다루지 않는다).
 */
export async function createTransitionPlan(
  personId: string,
  input: TransitionPlanInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = transitionPlanSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // 진입 가드 재검증 — 전환계획은 만 13세 미만(영유아기·아동기)에게 작성할 수 없다.
  const { data: person, error: personErr } = await supabase
    .from("persons")
    .select("birth_date")
    .eq("id", personId)
    .maybeSingle();
  if (personErr || !person) {
    return { error: "당사자를 찾을 수 없거나 접근 권한이 없습니다." };
  }
  if (isPreTransitionStage(computeLifeStage(person.birth_date as string))) {
    return { error: "전환계획은 만 13세 이상 당사자에게만 작성할 수 있습니다." };
  }

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: "TRA",
      record_type: "TRA-001",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: true,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `전환계획 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "TRA" });
  return { ok: true, recordId: row.id as string };
}

interface RawPlanDetailRow {
  id: string;
  person_id: string;
  content: unknown;
  is_draft: boolean | null;
  requires_confirmation: boolean | null;
  confirmer_id: string | null;
  confirmed_at: string | null;
  record_date: string;
}

/**
 * 해당 person의 최신 TRA-001 record 전체(content·확인 상태 포함) 반환. 없으면 null.
 * W-16 로드맵 시각화·재작성 프리필의 데이터 소스다. 접근 가능한 record만 RLS가 반환한다.
 */
export async function getLatestTransitionPlan(
  personId: string
): Promise<TransitionPlanDetail | null> {
  if (!UUID_RE.test(personId)) return null;

  const { data, error } = await supabase
    .from("records")
    .select(
      "id, person_id, content, is_draft, requires_confirmation, confirmer_id, confirmed_at, record_date"
    )
    .eq("person_id", personId)
    .eq("record_type", "TRA-001")
    .eq("is_draft", false)
    .order("record_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RawPlanDetailRow;

  await logAccess(row.person_id, "view", { recordId: row.id, domain: "TRA" });

  return {
    recordId: row.id,
    personId: row.person_id,
    content: row.content as TransitionPlanInput,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmerId: row.confirmer_id,
    confirmedAt: row.confirmed_at,
    recordDate: row.record_date,
  };
}
