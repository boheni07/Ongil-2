"use server";

import {
  ispSchema,
  ispGoalPatchSchema,
  serviceUsageSchema,
  type IspInput,
  type IspGoal,
  type IspGoalPatch,
  type ServiceUsageItem,
  type DomainKey,
} from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";
import { computeLifeStage } from "@/lib/lifecycle";
import type { LifeStage } from "@/components/lifecycle/StageBadge";
import { getTimeline as getTimelineImpl } from "../iep/actions";

/**
 * P2-2 사회복지사(social_worker) ISP 스위트 Server Action 모음.
 * W-01 홈(담당 당사자), W-13 ISP 작성, W-14 ISP 점검·달성률, W-17 서비스 이용 현황, W-20 타임라인.
 * docs/01-prd.md §5-6 F-W-01~05, docs/05-erd.md §3(WEL-004/WEL-005)·§4-2·§4-6.
 *
 * P2-1 IEP 스위트(records/iep/actions.ts)와 동일 구조를 social_worker/WEL 도메인에 이식한 것이다.
 * 접근 통제는 전부 기존 RLS(§4-2)에 위임한다 — records 쓰기는 permissions(도메인 write/edit)
 * 분기가 access_level만 보고 강제하며 role 무관이라 social_worker도 동일하게 커버된다.
 * "담당 당사자"는 이 사회복지사가 활성 permissions를 보유한 persons로 정의한다(도메인 무관).
 *
 * W-20 타임라인은 domain 무관 범용 함수라 iep/actions.ts의 getTimeline을 그대로 재사용한다
 * (아래 re-export — 중복 구현하지 않는다).
 */

export type { TimelineItem } from "../iep/actions";

/**
 * W-20 타임라인 — domain 무관 범용 함수라 iep/actions.getTimeline을 그대로 위임한다.
 * "use server" 파일은 값 re-export(`export { x } from`)를 허용하지 않아 인라인 래퍼로 감싼다.
 */
export async function getTimeline(
  ...args: Parameters<typeof getTimelineImpl>
): ReturnType<typeof getTimelineImpl> {
  return getTimelineImpl(...args);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

/** W-01 담당 당사자 카드. */
export interface SocialWorkerClient {
  personId: string;
  fullName: string;
  birthDate: string;
  avatarUrl: string | null;
  lifeStage: LifeStage;
  /** 가장 최근 제출된 ISP(WEL-004) record id. 없으면 null(W-13 "새 ISP 작성"으로 유도). */
  latestIspRecordId: string | null;
  ispGoalCount: number;
  /** 채워진 goals[].achievement_rate 평균(0~100 반올림). 하나도 없으면 null. */
  ispAchievementAvg: number | null;
  /** 최신 ISP의 reassessment_date - 오늘(일수). 음수면 이미 지남, null이면 ISP 없음. */
  reassessmentDday: number | null;
}

/** W-14 ISP 점검 상세. */
export interface IspDetail {
  recordId: string;
  personId: string;
  content: IspInput;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmerId: string | null;
  confirmedAt: string | null;
  recordDate: string;
  /** reassessment_date - 오늘(일수). 0~30이면 프론트가 D-30 경고 배지 노출. 없으면 null. */
  reassessmentDday: number | null;
}

/** W-17 서비스 이용 현황 행(WEL-005.services[]를 평탄화). */
export interface ServiceUsageRow {
  personId: string;
  personName: string;
  serviceName: string;
  domain: "WEL";
  provider: string;
  /** "2026-01-15 ~ 진행" 형태. end_date 없으면 "진행". */
  period: string;
  status: "active" | "paused" | "ended";
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/**
 * YYYY-MM-DD 기준 "오늘까지 남은 일수". 로컬 자정 기준으로 계산해 TZ 드리프트를 피한다.
 * 음수면 이미 지난 날짜. 파싱 불가/누락이면 null.
 */
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** content에서 goals 배열을 안전하게 추출한다. */
function ispGoals(content: unknown): IspGoal[] {
  const c = content as { goals?: unknown } | null;
  return Array.isArray(c?.goals) ? (c.goals as IspGoal[]) : [];
}

/** content에서 reassessment_date를 안전하게 추출한다. */
function ispReassessmentDate(content: unknown): string | null {
  const c = content as { reassessment_date?: unknown } | null;
  return typeof c?.reassessment_date === "string" ? c.reassessment_date : null;
}

interface RawIspRow {
  id: string;
  person_id: string;
  content: unknown;
  record_date: string;
}

/**
 * W-01 홈 담당 당사자 목록 — 이 사회복지사가 활성 permissions를 보유한 persons(도메인 무관).
 * 각 당사자의 최근 제출 ISP(WEL-004)에서 목표 수·달성률 평균·재사정 D-day를 파생한다.
 * life_stage는 클라이언트 헬퍼(computeLifeStage)로 통일한다(DB get_life_stage와 값 체계 상이 —
 * IEP 라운드와 동일 결정).
 */
export async function getSocialWorkerClients(): Promise<SocialWorkerClient[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [permsRes, guardianRes] = await Promise.all([
    supabase.from("permissions").select("person_id").eq("grantee_id", user.id).eq("is_active", true),
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

  const [personsRes, ispRes] = await Promise.all([
    supabase.from("persons").select("id, full_name, birth_date, avatar_url").in("id", personIds),
    supabase
      .from("records")
      .select("id, person_id, content, record_date")
      .in("person_id", personIds)
      .eq("record_type", "WEL-004")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
  ]);

  const persons = personsRes.data ?? [];
  const isps = (ispRes.data ?? []) as RawIspRow[];

  // person_id별 가장 최근 WEL-004 하나만 남긴다(정렬이 내림차순이라 첫 등장이 최신).
  const latestByPerson = new Map<string, RawIspRow>();
  for (const row of isps) {
    if (!latestByPerson.has(row.person_id)) latestByPerson.set(row.person_id, row);
  }

  return persons.map((p) => {
    const isp = latestByPerson.get(p.id as string) ?? null;
    const goals = isp ? ispGoals(isp.content) : [];
    const rates = goals
      .map((g) => g.achievement_rate)
      .filter((r): r is number => typeof r === "number");
    return {
      personId: p.id as string,
      fullName: (p.full_name as string) ?? "",
      birthDate: p.birth_date as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      lifeStage: computeLifeStage(p.birth_date as string),
      latestIspRecordId: isp?.id ?? null,
      ispGoalCount: goals.length,
      ispAchievementAvg: rates.length
        ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
        : null,
      reassessmentDday: isp ? daysUntil(ispReassessmentDate(isp.content)) : null,
    };
  });
}

/**
 * W-01 홈 KPI "전환계획 진행중"·"이번 주 서비스" — 프로토타입 web-social-worker.html
 * 218~220줄(2026-07-19, docs/12 Wave C). 이전엔 두 KPI 자체가 없었다(3개 카드만 존재).
 * "진행중"은 로드맵 마지막 단계(employment)에 아직 도달하지 않은 TRA-001 최신본 기준,
 * "이번 주 서비스"는 이 사회복지사의 담당 당사자 전원에 대해 이번 주 작성된 기록 수(도메인
 * 무관 — W-01 KPI 자체가 서비스 전반을 다루므로 WEL 도메인만으로 좁히지 않는다).
 */
export async function getSocialWorkerWeeklyStats(
  personIds: string[]
): Promise<{ transitionInProgress: number; weeklyRecordCount: number }> {
  if (personIds.length === 0) return { transitionInProgress: 0, weeklyRecordCount: 0 };

  const supabase = await createClient();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [traRes, weeklyRes] = await Promise.all([
    supabase
      .from("records")
      .select("person_id, content, record_date")
      .in("person_id", personIds)
      .eq("record_type", "TRA-001")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
    supabase
      .from("records")
      .select("id", { count: "exact", head: true })
      .in("person_id", personIds)
      .eq("is_draft", false)
      .gte("record_date", weekStart.toISOString()),
  ]);

  const latestStageByPerson = new Map<string, string | null>();
  for (const row of traRes.data ?? []) {
    const pid = row.person_id as string;
    if (latestStageByPerson.has(pid)) continue; // 이미 최신본(내림차순 정렬) 처리됨
    const content = row.content as { roadmap_stage?: string } | null;
    latestStageByPerson.set(pid, content?.roadmap_stage ?? null);
  }
  const transitionInProgress = [...latestStageByPerson.values()].filter(
    (stage) => stage && stage !== "employment"
  ).length;

  return { transitionInProgress, weeklyRecordCount: weeklyRes.count ?? 0 };
}

/**
 * W-13 ISP 작성 — records INSERT(domain='WEL', record_type='WEL-004').
 * ISP는 IEP와 동급의 공식 문서라 requires_confirmation=true(§4-6 표) — 제출(is_draft=false) 시
 * trg_assign_confirmer가 확인 주체(성년=본인, 미성년=주보호자)를 자동 지정한다.
 */
export async function createIsp(
  input: IspInput & { personId: string }
): Promise<ActionResult & { recordId?: string }> {
  const { personId, ...content } = input;
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = ispSchema.safeParse(content);
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
      record_type: "WEL-004",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: true,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `ISP 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "WEL" });
  return { ok: true, recordId: row.id as string };
}

interface RawIspDetailRow {
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
 * W-14 ISP 점검 상세 — content 전체 + 재사정 D-day 계산값.
 * 재사정 D-30 경고 배지 판정은 서버가 내려주는 reassessmentDday로 프론트가 한다
 * (프론트가 날짜 계산을 중복하지 않도록).
 */
export async function getIspDetail(recordId: string): Promise<IspDetail | null> {
  if (!UUID_RE.test(recordId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(
      "id, person_id, content, is_draft, requires_confirmation, confirmer_id, confirmed_at, record_date"
    )
    .eq("id", recordId)
    .eq("record_type", "WEL-004")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RawIspDetailRow;
  const content = row.content as IspInput;

  await logAccess(row.person_id, "view", { recordId: row.id, domain: "WEL" });

  return {
    recordId: row.id,
    personId: row.person_id,
    content,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmerId: row.confirmer_id,
    confirmedAt: row.confirmed_at,
    recordDate: row.record_date,
    reassessmentDday: daysUntil(ispReassessmentDate(content)),
  };
}

/**
 * W-14 인라인 편집 — content.goals[goalIndex]에 patch를 얕게 병합하고 나머지는 보존.
 * JSONB 전체를 읽어와 해당 인덱스만 갱신해 다시 쓴다(과도한 정규화 없이 실용적 처리).
 * content 변경이므로 이미 확인된(confirmed_at) ISP는 trg_reset_confirmation_on_edit(§4-6④)에
 * 의해 재확인 대기로 되돌아간다(의도된 동작). UPDATE 권한은 records_update RLS(permissions
 * edit 분기)가 강제한다.
 */
export async function updateIspGoal(
  recordId: string,
  goalIndex: number,
  patch: IspGoalPatch
): Promise<ActionResult> {
  if (!UUID_RE.test(recordId)) return { error: "기록 정보가 올바르지 않습니다." };
  if (!Number.isInteger(goalIndex) || goalIndex < 0) {
    return { error: "목표 위치가 올바르지 않습니다." };
  }
  const parsed = ispGoalPatchSchema.safeParse(patch);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: existing, error: selErr } = await supabase
    .from("records")
    .select("id, person_id, domain, content")
    .eq("id", recordId)
    .eq("record_type", "WEL-004")
    .maybeSingle();

  if (selErr || !existing) {
    return { error: "ISP를 찾을 수 없거나 접근 권한이 없습니다." };
  }

  const content = (existing.content ?? {}) as Record<string, unknown>;
  const goals = ispGoals(content).slice();
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

interface RawServiceUsageRow {
  person_id: string;
  content: unknown;
}

/**
 * W-17 서비스 이용 현황 — 담당 당사자 전원의 WEL-005.services[]를 평탄화한 표.
 * status 필터(active/paused/ended)를 지원한다. 전환 서비스(TRA-001)는 이번 라운드 범위 밖이라
 * 다루지 않는다(WEL-005만). 접근 가능한 record만 RLS가 반환한다.
 */
export async function getServiceUsage(filters?: {
  status?: "active" | "paused" | "ended";
}): Promise<ServiceUsageRow[]> {
  const supabase = await createClient();
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

  const [personsRes, planRes] = await Promise.all([
    supabase.from("persons").select("id, full_name").in("id", personIds),
    supabase
      .from("records")
      .select("person_id, content")
      .in("person_id", personIds)
      .eq("record_type", "WEL-005")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
  ]);

  const nameById = new Map<string, string>();
  for (const p of personsRes.data ?? []) {
    nameById.set(p.id as string, (p.full_name as string) ?? "");
  }

  const rows: ServiceUsageRow[] = [];
  for (const rec of (planRes.data ?? []) as RawServiceUsageRow[]) {
    const c = rec.content as { services?: unknown } | null;
    const services = Array.isArray(c?.services) ? (c.services as ServiceUsageItem[]) : [];
    for (const s of services) {
      if (filters?.status && s.status !== filters.status) continue;
      rows.push({
        personId: rec.person_id,
        personName: nameById.get(rec.person_id) ?? "",
        serviceName: s.service_name ?? "",
        domain: "WEL",
        provider: s.provider ?? "",
        period: `${s.start_date ?? ""} ~ ${s.end_date ?? "진행"}`,
        status: s.status,
      });
    }
  }

  return rows;
}

/**
 * docs/14 워크숍 Wave W-1 — 담당 당사자별 최신 WEL-005(서비스 이용현황) `next_review_date`.
 * 지금까지 이 필드가 스키마엔 있는데 홈 화면 어디서도 조회되지 않고 있었다(§1 조사).
 * SocialWorkerHome의 "이번 주 처리할 일" 카드가 사용한다.
 */
export async function getServiceUsageNextReviewDates(): Promise<
  { personId: string; personName: string; nextReviewDate: string }[]
> {
  const supabase = await createClient();
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

  const [personsRes, planRes] = await Promise.all([
    supabase.from("persons").select("id, full_name").in("id", personIds),
    supabase
      .from("records")
      .select("person_id, content")
      .in("person_id", personIds)
      .eq("record_type", "WEL-005")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
  ]);

  const nameById = new Map<string, string>();
  for (const p of personsRes.data ?? []) {
    nameById.set(p.id as string, (p.full_name as string) ?? "");
  }

  const seen = new Set<string>();
  const rows: { personId: string; personName: string; nextReviewDate: string }[] = [];
  for (const rec of (planRes.data ?? []) as RawServiceUsageRow[]) {
    if (seen.has(rec.person_id)) continue; // record_date 내림차순 정렬이라 첫 등장이 최신
    seen.add(rec.person_id);
    const c = rec.content as { next_review_date?: unknown } | null;
    if (typeof c?.next_review_date !== "string") continue;
    rows.push({
      personId: rec.person_id,
      personName: nameById.get(rec.person_id) ?? "",
      nextReviewDate: c.next_review_date,
    });
  }

  return rows;
}
