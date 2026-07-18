import {
  therapyPlanSchema,
  therapyPlanGoalPatchSchema,
  sessionNoteSchema,
  type TherapyPlanInput,
  type TherapyPlanGoal,
  type TherapyPlanGoalPatch,
  type TherapyDomainScores,
  type TherapyArea,
  type SessionNoteInput,
  type DomainKey,
} from "@ongil/validation";
import { supabase } from "./supabase";
import { computeLifeStage, type LifeStage } from "./iep";

/**
 * P2-3 치료사(therapist) 치료계획서+회기일지 스위트 데이터 접근(모바일).
 * 웹 Server Action(apps/web/src/app/(app)/records/therapy/actions.ts)의 로직을
 * Supabase 직접 호출로 동일하게 재현한다. DB 계약(테이블·컬럼·record_type 값·
 * requires_confirmation 규칙)은 웹과 1:1 대응하며 임의로 바꾸지 않는다.
 *
 * P2-1 IEP·P2-2 ISP 스위트(lib/iep.ts·lib/isp.ts)와 동일 구조를 therapist/MED 도메인에 이식한 것이다.
 * 접근 통제는 전부 기존 RLS(§4-2)에 위임한다 — records 쓰기는 permissions(도메인 write/edit)
 * 분기가 access_level만 보고 강제하며 role 무관이라 therapist도 동일하게 커버된다.
 * "담당 아동"은 이 치료사가 활성 permissions를 보유한 persons로 정의한다(도메인 무관).
 *
 * TH-20 타임라인은 domain 무관 범용 함수라 lib/iep.ts의 getTimeline을 그대로 재사용한다
 * (아래 re-export — 중복 구현하지 않는다). logAccess는 iep/isp와 동일하게 여기서도 재정의한다
 * (모듈 경계상 iep.ts의 것은 export되지 않음).
 */

export { getTimeline, computeLifeStage, getPersonBirthDate, isSelfConfirmingStage, isPreTransitionStage } from "./iep";
export type { TimelineItem, LifeStage } from "./iep";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * G-40 접근 로그 기록(모바일) — access_logs INSERT(§4-4). iep/isp의 logAccess와 동일하며,
 * next/headers(IP·UA)가 없어 ip_address/user_agent는 null로 둔다. 감사 로그는 best-effort라
 * 실패해도 사용자 작업을 막지 않도록 모든 오류를 삼킨다.
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

/** TH-01 담당 아동 카드. */
export interface TherapistClient {
  personId: string;
  fullName: string;
  birthDate: string;
  lifeStage: LifeStage;
  /** 가장 최근 제출된 치료계획서(MED-005) record id. 없으면 null(TH-13 "새 계획서 작성"으로 유도). */
  latestPlanRecordId: string | null;
  planGoalCount: number;
  /** 이 아동의 회기일지(MED-006) 총 개수. */
  sessionCount: number;
}

/** TH-14 계획서 상세. */
export interface TherapyPlanDetail {
  recordId: string;
  personId: string;
  content: TherapyPlanInput;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmerId: string | null;
  confirmedAt: string | null;
  recordDate: string;
  /** 이 계획서에 연결된(therapy_plan_id=recordId) MED-006 진행 회기 수. */
  sessionCount: number;
  /**
   * 이 계획서에 연결된 가장 최근 회기일지의 domain_scores(영역별 최신 달성도). 없으면 null.
   * goals[].area(4영역 enum)와 domain_scores 키가 1:1이라 프론트가 목표별로 정확히 매핑한다.
   */
  latestDomainScores: TherapyDomainScores | null;
}

/** TH-15 회기일지 작성 진입 컨텍스트("치료계획 자동연결"의 결과). */
export interface SessionComposeContext {
  /** 자동 연결된 최근 확정 MED-005 record id. 없으면 null(TH-13으로 유도). */
  therapyPlanId: string | null;
  /** 연결된 계획서의 목표 배열(계획 vs 실제 비교 패널 좌측). 없으면 빈 배열. */
  planGoals: TherapyPlanGoal[];
  /** 다음 회기 차수(연결 계획서에 딸린 기존 회기 수 + 1). 계획서 없으면 1. */
  sessionNumber: number;
  /** 직전 회기의 진행상황·달성도(연속성 참조). 없으면 null. */
  previousSession: { actualProgress: string; domainScores: TherapyDomainScores } | null;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/** content에서 goals 배열을 안전하게 추출한다. */
function planGoals(content: unknown): TherapyPlanGoal[] {
  const c = content as { goals?: unknown } | null;
  return Array.isArray(c?.goals) ? (c.goals as TherapyPlanGoal[]) : [];
}

/** content에서 domain_scores를 안전하게 추출한다(4키 모두 숫자일 때만). */
function sessionDomainScores(content: unknown): TherapyDomainScores | null {
  const c = content as { domain_scores?: unknown } | null;
  const s = c?.domain_scores as Record<string, unknown> | undefined;
  if (!s) return null;
  const keys: TherapyArea[] = ["physical", "language", "cognitive", "social"];
  if (!keys.every((k) => typeof s[k] === "number")) return null;
  return {
    physical: s.physical as number,
    language: s.language as number,
    cognitive: s.cognitive as number,
    social: s.social as number,
  };
}

interface RawPlanRow {
  id: string;
  person_id: string;
  content: unknown;
  record_date: string;
}

/**
 * TH-01 홈 담당 아동 목록 — 이 치료사가 활성 permissions를 보유한 persons(도메인 무관).
 * 각 아동의 최근 제출 계획서(MED-005)에서 목표 수를, MED-006 개수로 진행 회기 수를 파생한다.
 * life_stage는 클라이언트 헬퍼(computeLifeStage)로 통일한다(직전 라운드와 동일 결정).
 */
export async function getTherapistClients(): Promise<TherapistClient[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: perms } = await supabase
    .from("permissions")
    .select("person_id")
    .eq("grantee_id", user.id)
    .eq("is_active", true);
  if (!perms || perms.length === 0) return [];

  const personIds = [...new Set(perms.map((p) => p.person_id as string))];

  const [personsRes, planRes, sessionRes] = await Promise.all([
    supabase.from("persons").select("id, full_name, birth_date").in("id", personIds),
    supabase
      .from("records")
      .select("id, person_id, content, record_date")
      .in("person_id", personIds)
      .eq("record_type", "MED-005")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
    supabase
      .from("records")
      .select("person_id")
      .in("person_id", personIds)
      .eq("record_type", "MED-006"),
  ]);

  const persons = personsRes.data ?? [];
  const plans = (planRes.data ?? []) as RawPlanRow[];

  // person_id별 가장 최근 MED-005 하나만 남긴다(정렬이 내림차순이라 첫 등장이 최신).
  const latestByPerson = new Map<string, RawPlanRow>();
  for (const row of plans) {
    if (!latestByPerson.has(row.person_id)) latestByPerson.set(row.person_id, row);
  }

  // person_id별 회기일지 수.
  const sessionCountByPerson = new Map<string, number>();
  for (const row of sessionRes.data ?? []) {
    const pid = row.person_id as string;
    sessionCountByPerson.set(pid, (sessionCountByPerson.get(pid) ?? 0) + 1);
  }

  return persons.map((p) => {
    const plan = latestByPerson.get(p.id as string) ?? null;
    const goals = plan ? planGoals(plan.content) : [];
    return {
      personId: p.id as string,
      fullName: (p.full_name as string) ?? "",
      birthDate: p.birth_date as string,
      lifeStage: computeLifeStage(p.birth_date as string),
      latestPlanRecordId: plan?.id ?? null,
      planGoalCount: goals.length,
      sessionCount: sessionCountByPerson.get(p.id as string) ?? 0,
    };
  });
}

/**
 * TH-13 치료계획서 작성 — records INSERT(domain='MED', record_type='MED-005').
 * 치료계획서는 IEP/ISP와 동급의 공식 문서라 requires_confirmation=true(§4-6 표) — 제출(is_draft=false)
 * 시 trg_assign_confirmer가 확인 주체(성년=본인, 미성년=주보호자)를 자동 지정한다.
 */
export async function createTherapyPlan(
  input: TherapyPlanInput & { personId: string }
): Promise<ActionResult & { recordId?: string }> {
  const { personId, ...content } = input;
  if (!UUID_RE.test(personId)) return { error: "아동 정보가 올바르지 않습니다." };

  const parsed = therapyPlanSchema.safeParse(content);
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
      domain: "MED",
      record_type: "MED-005",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: true,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `치료계획서 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "MED" });
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
 * TH-14 계획서 상세 — content 전체 + 진행 회기 수 + 각 영역 최신 달성도.
 * 진행 회기 수·최신 달성도는 이 계획서에 연결된(therapy_plan_id=recordId) MED-006에서 파생한다.
 * goals[].area(4영역 enum)와 domain_scores 키가 1:1이라 프론트가 목표별 달성도를 정확히 매핑한다.
 */
export async function getTherapyPlanDetail(
  recordId: string
): Promise<TherapyPlanDetail | null> {
  if (!UUID_RE.test(recordId)) return null;

  const { data, error } = await supabase
    .from("records")
    .select(
      "id, person_id, content, is_draft, requires_confirmation, confirmer_id, confirmed_at, record_date"
    )
    .eq("id", recordId)
    .eq("record_type", "MED-005")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RawPlanDetailRow;
  const content = row.content as TherapyPlanInput;

  await logAccess(row.person_id, "view", { recordId: row.id, domain: "MED" });

  // 이 계획서에 연결된 회기일지(MED-006) — 최신순. 개수·최신 달성도를 파생한다.
  const { data: sessions } = await supabase
    .from("records")
    .select("content, record_date")
    .eq("person_id", row.person_id)
    .eq("record_type", "MED-006")
    .order("record_date", { ascending: false })
    .limit(100);

  const linked = ((sessions ?? []) as { content: unknown }[]).filter((s) => {
    const c = s.content as { therapy_plan_id?: unknown } | null;
    return c?.therapy_plan_id === recordId;
  });

  let latestDomainScores: TherapyDomainScores | null = null;
  for (const s of linked) {
    const scores = sessionDomainScores(s.content);
    if (scores) {
      latestDomainScores = scores;
      break;
    }
  }

  return {
    recordId: row.id,
    personId: row.person_id,
    content,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmerId: row.confirmer_id,
    confirmedAt: row.confirmed_at,
    recordDate: row.record_date,
    sessionCount: linked.length,
    latestDomainScores,
  };
}

/**
 * TH-14/TH-15 인라인 편집 — content.goals[goalIndex]에 patch를 얕게 병합하고 나머지는 보존.
 * JSONB 전체를 읽어와 해당 인덱스만 갱신해 다시 쓴다(직전 라운드 패턴 그대로).
 * content 변경이므로 이미 확인된(confirmed_at) 계획서는 trg_reset_confirmation_on_edit(§4-6④)에
 * 의해 재확인 대기로 되돌아간다(의도된 동작). UPDATE 권한은 records_update RLS(permissions
 * edit 분기)가 강제한다.
 */
export async function updateTherapyPlanGoal(
  recordId: string,
  goalIndex: number,
  patch: TherapyPlanGoalPatch
): Promise<ActionResult> {
  if (!UUID_RE.test(recordId)) return { error: "기록 정보가 올바르지 않습니다." };
  if (!Number.isInteger(goalIndex) || goalIndex < 0) {
    return { error: "목표 위치가 올바르지 않습니다." };
  }
  const parsed = therapyPlanGoalPatchSchema.safeParse(patch);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { data: existing, error: selErr } = await supabase
    .from("records")
    .select("id, person_id, domain, content")
    .eq("id", recordId)
    .eq("record_type", "MED-005")
    .maybeSingle();

  if (selErr || !existing) {
    return { error: "치료계획서를 찾을 수 없거나 접근 권한이 없습니다." };
  }

  const content = (existing.content ?? {}) as Record<string, unknown>;
  const goals = planGoals(content).slice();
  if (goalIndex >= goals.length) return { error: "해당 목표를 찾을 수 없습니다." };

  goals[goalIndex] = { ...goals[goalIndex], ...parsed.data };
  const nextContent = { ...content, goals };

  const { error: updErr } = await supabase
    .from("records")
    .update({ content: nextContent, updated_at: new Date().toISOString() })
    .eq("id", recordId);

  if (updErr) return { error: `목표 수정에 실패했습니다: ${updErr.message}` };
  await logAccess(existing.person_id as string, "update", {
    recordId,
    domain: existing.domain as DomainKey,
  });
  return { ok: true };
}

/**
 * TH-15 회기일지 작성 진입 컨텍스트 — "치료계획 자동연결"이 여기서 이뤄진다.
 * 이 아동의 가장 최근 확정(is_draft=false) MED-005 하나를 자동으로 찾아 therapyPlanId로 반환하고
 * (프로토타입 "계획서 THP-… 자동 연결됨" 칩), 그 계획서의 목표(계획 vs 실제 비교 패널 좌측),
 * 다음 회기 차수(연결 계획서에 딸린 회기 수 + 1), 직전 회기의 진행상황·달성도를 함께 내려준다.
 */
export async function getSessionComposeContext(
  personId: string
): Promise<SessionComposeContext> {
  const empty: SessionComposeContext = {
    therapyPlanId: null,
    planGoals: [],
    sessionNumber: 1,
    previousSession: null,
  };
  if (!UUID_RE.test(personId)) return empty;

  // 자동연결: 가장 최근 확정 MED-005 하나.
  const { data: planRow } = await supabase
    .from("records")
    .select("id, content")
    .eq("person_id", personId)
    .eq("record_type", "MED-005")
    .eq("is_draft", false)
    .order("record_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!planRow) return empty;
  const therapyPlanId = planRow.id as string;

  // 연결된 계획서에 딸린 회기일지 — 최신순. 개수(차수 계산)·직전 회기(연속성) 파생.
  const { data: sessions } = await supabase
    .from("records")
    .select("content, record_date")
    .eq("person_id", personId)
    .eq("record_type", "MED-006")
    .order("record_date", { ascending: false })
    .limit(100);

  const linked = ((sessions ?? []) as { content: unknown }[]).filter((s) => {
    const c = s.content as { therapy_plan_id?: unknown } | null;
    return c?.therapy_plan_id === therapyPlanId;
  });

  let previousSession: SessionComposeContext["previousSession"] = null;
  for (const s of linked) {
    const scores = sessionDomainScores(s.content);
    const c = s.content as { actual_progress?: unknown } | null;
    if (scores) {
      previousSession = {
        actualProgress: typeof c?.actual_progress === "string" ? c.actual_progress : "",
        domainScores: scores,
      };
      break;
    }
  }

  return {
    therapyPlanId,
    planGoals: planGoals(planRow.content),
    sessionNumber: linked.length + 1,
    previousSession,
  };
}

/**
 * TH-15 회기일지 작성 — records INSERT(domain='MED', record_type='MED-006').
 * 일상 기록이라 requires_confirmation=false(§4-6 표). session_date를 record_date로 쓴다.
 * therapy_plan_id는 getSessionComposeContext가 자동 연결해 채운 값을 그대로 저장한다.
 */
export async function createSessionNote(
  input: SessionNoteInput & { personId: string }
): Promise<ActionResult & { recordId?: string }> {
  const { personId, ...content } = input;
  if (!UUID_RE.test(personId)) return { error: "아동 정보가 올바르지 않습니다." };

  const parsed = sessionNoteSchema.safeParse(content);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const sessionDate = new Date(parsed.data.session_date);
  const recordDate = Number.isNaN(sessionDate.getTime())
    ? new Date().toISOString()
    : sessionDate.toISOString();

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: "MED",
      record_type: "MED-006",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: false,
      record_date: recordDate,
    })
    .select("id")
    .single();

  if (insErr) return { error: `회기 일지 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "MED" });
  return { ok: true, recordId: row.id as string };
}
