import {
  iepSchema,
  iepGoalPatchSchema,
  observationSchema,
  recordDisplayTitle,
  type IepInput,
  type IepAnnualGoal,
  type IepGoalPatch,
  type ObservationInput,
  type DomainKey,
} from "@ongil/validation";
import { supabase } from "./supabase";
import { koreanAge } from "./date";

/**
 * P2-1 특수교사(teacher) IEP 스위트 데이터 접근(모바일).
 * 웹 Server Action(apps/web/src/app/(app)/records/iep/actions.ts)의 로직을
 * Supabase 직접 호출로 동일하게 재현한다. DB 계약(테이블·컬럼·record_type 값·
 * requires_confirmation 규칙·이전버전/관찰기록 매칭 로직)은 웹과 1:1 대응하며 임의로 바꾸지 않는다.
 *
 * 접근 통제는 전부 기존 RLS(§4-2)에 위임한다 — 전문가 역할의 records 쓰기는 permissions
 * (도메인 write/edit) 분기가 access_level만 보고 강제하며 teacher도 동일하게 커버된다.
 * "담당 학생"은 이 교사가 활성 permissions를 보유한 persons로 정의한다(도메인 무관).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 생애주기 5단계(2026-07-17 개정, docs/07-lifecycle-record-permission-proposal.md v0.2) —
 * 웹 computeLifeStage(apps/web/src/lib/lifecycle.ts)와 동일 경계.
 * 0~5 영유아기 · 6~12 아동기 · 13~18 청소년 전환기 · 19~64 성인기 · 65+ 노년기.
 */
export type LifeStage = "infant" | "child" | "youth_transition" | "adult" | "senior";

function stageFromAge(age: number): LifeStage {
  if (age < 6) return "infant";
  if (age < 13) return "child";
  if (age < 19) return "youth_transition";
  if (age < 65) return "adult";
  return "senior";
}

export function computeLifeStage(birthDate: string): LifeStage {
  return stageFromAge(koreanAge(birthDate) ?? 0);
}

/** 확인 주체가 "본인"인 단계인지 — 성인기·노년기(만 19세 이상). */
export function isSelfConfirmingStage(stage: LifeStage): boolean {
  return stage === "adult" || stage === "senior";
}

/** 전환계획·전환 섹션이 아직 잠겨 있는 단계인지 — 영유아기·아동기(만 12세 이하). */
export function isPreTransitionStage(stage: LifeStage): boolean {
  return stage === "infant" || stage === "child";
}

/**
 * 개별화전환계획(ITP, EDU-005)이 활성인 단계인지 — 청소년 전환기(만 13~18세)만.
 * 웹 isItpActiveStage(apps/web/src/lib/lifecycle.ts)와 동일. TRA-001의 isPreTransitionStage와
 * 달리 "전환기 그 자체"에서만 true다(성인기 이후엔 TRA-001 실행 로드맵으로 넘어감).
 */
export function isItpActiveStage(stage: LifeStage): boolean {
  return stage === "youth_transition";
}

/**
 * 특정 시점(기록 작성일 등) 기준 생애주기 단계. 타임라인 단계 필터가 "기록 작성 시점 나이"로
 * 항목을 분류할 때 쓴다. computeLifeStage와 동일한 5단계 경계를 적용한다.
 */
export function lifeStageAt(birthDate: string, atISO: string): LifeStage | null {
  const b = new Date(birthDate);
  const at = new Date(atISO);
  if (Number.isNaN(b.getTime()) || Number.isNaN(at.getTime())) return null;
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age -= 1;
  return stageFromAge(age);
}

/** 타임라인 생애주기 배지·필터·구분선용 — personId의 birth_date 단건 조회(RLS 범위 내). */
export async function getPersonBirthDate(personId: string): Promise<string | null> {
  if (!UUID_RE.test(personId)) return null;
  const { data } = await supabase
    .from("persons")
    .select("birth_date")
    .eq("id", personId)
    .maybeSingle();
  return (data?.birth_date as string | undefined) ?? null;
}

/** birthDate + years년이 되는 날(만 N세 도달일)의 ISO. 타임라인 14/18세 구분선 위치 계산용. */
export function lifeStageBoundaryISO(birthDate: string, years: number): string | null {
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const d = new Date(b);
  d.setFullYear(b.getFullYear() + years);
  return d.toISOString();
}

/**
 * G-40 접근 로그 기록(모바일) — access_logs INSERT(§4-4). 웹 logAccess를 옮긴 것으로,
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

/** T-01 담당 학생 카드. */
export interface TeacherStudent {
  personId: string;
  fullName: string;
  birthDate: string;
  lifeStage: LifeStage;
  /** 가장 최근 제출된 IEP(EDU-001) record id. 없으면 null(T-13 "새 IEP 작성"으로 유도). */
  latestIepRecordId: string | null;
  iepGoalCount: number;
  /** 채워진 annual_goals[].achievement_rate 평균(0~100 반올림). 하나도 없으면 null. */
  iepAchievementAvg: number | null;
}

/** T-14 "이전 버전 비교" 패널용 이전 학년도 IEP. */
export interface IepPreviousVersion {
  recordId: string;
  academicYear: string;
  content: IepInput;
}

/** T-14 "관찰기록 연결" 패널용 항목. */
export interface LinkedObservation {
  recordId: string;
  situation: string;
  observedAt: string;
  linkedGoalArea: string;
  tags: string[];
}

/** T-14 IEP 점검 상세. */
export interface IepDetail {
  recordId: string;
  personId: string;
  content: IepInput;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmerId: string | null;
  confirmedAt: string | null;
  recordDate: string;
  previousVersion: IepPreviousVersion | null;
  linkedObservations: LinkedObservation[];
}

/** T-20 타임라인 항목(스트림·레인 뷰 공용). */
export interface TimelineItem {
  id: string;
  domain: DomainKey;
  recordType: string;
  title: string;
  date: string;
  isMilestone: boolean;
  isPinned: boolean;
  isDraft: boolean;
  tags: string[];
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/** content에서 annual_goals 배열을 안전하게 추출한다. */
function iepAnnualGoals(content: unknown): IepAnnualGoal[] {
  const c = content as { annual_goals?: unknown } | null;
  return Array.isArray(c?.annual_goals) ? (c.annual_goals as IepAnnualGoal[]) : [];
}

interface RawIepRow {
  id: string;
  person_id: string;
  content: unknown;
  record_date: string;
}

/**
 * T-01 홈 담당 학생 목록 — 이 교사가 활성 permissions를 보유한 persons(도메인 무관).
 * 각 학생의 최근 제출 IEP(EDU-001)에서 목표 수·달성률 평균을 파생한다.
 */
export async function getTeacherStudents(): Promise<TeacherStudent[]> {
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

  const [personsRes, iepRes] = await Promise.all([
    supabase.from("persons").select("id, full_name, birth_date").in("id", personIds),
    supabase
      .from("records")
      .select("id, person_id, content, record_date")
      .in("person_id", personIds)
      .eq("record_type", "EDU-001")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
  ]);

  const persons = personsRes.data ?? [];
  const ieps = (iepRes.data ?? []) as RawIepRow[];

  // person_id별 가장 최근 EDU-001 하나만 남긴다(정렬이 내림차순이라 첫 등장이 최신).
  const latestByPerson = new Map<string, RawIepRow>();
  for (const row of ieps) {
    if (!latestByPerson.has(row.person_id)) latestByPerson.set(row.person_id, row);
  }

  return persons.map((p) => {
    const iep = latestByPerson.get(p.id as string) ?? null;
    const goals = iep ? iepAnnualGoals(iep.content) : [];
    const rates = goals
      .map((g) => g.achievement_rate)
      .filter((r): r is number => typeof r === "number");
    return {
      personId: p.id as string,
      fullName: (p.full_name as string) ?? "",
      birthDate: p.birth_date as string,
      lifeStage: computeLifeStage(p.birth_date as string),
      latestIepRecordId: iep?.id ?? null,
      iepGoalCount: goals.length,
      iepAchievementAvg: rates.length
        ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
        : null,
    };
  });
}

/**
 * T-13 IEP 작성 — records INSERT(domain='EDU', record_type='EDU-001').
 * IEP는 공식 문서라 requires_confirmation=true(§4-6). 제출(is_draft=false) 시
 * trg_assign_confirmer가 확인 주체를 자동 지정한다. transition_plan은 프론트가 만 13세+에서만 전송.
 */
export async function createIep(
  input: IepInput & { personId: string }
): Promise<ActionResult & { recordId?: string }> {
  const { personId, ...content } = input;
  if (!UUID_RE.test(personId)) return { error: "학생 정보가 올바르지 않습니다." };

  const parsed = iepSchema.safeParse(content);
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
      domain: "EDU",
      record_type: "EDU-001",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: true,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `IEP 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "EDU" });
  return { ok: true, recordId: row.id as string };
}

interface RawIepDetailRow {
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
 * T-14 IEP 점검 상세 — content 전체 + 이전 학년도 IEP(비교용) + 연결된 관찰기록.
 * previousVersion: 같은 person의 더 이전 academic_year EDU-001 중 가장 최근(없으면 null).
 * linkedObservations: 같은 person의 EDU-002 중 content.linkedGoalArea가 이 IEP의 목표 영역명
 *   (또는 "영역 · 목표" 라벨)과 일치하는 최근 5건.
 */
export async function getIepDetail(recordId: string): Promise<IepDetail | null> {
  if (!UUID_RE.test(recordId)) return null;

  const { data, error } = await supabase
    .from("records")
    .select(
      "id, person_id, content, is_draft, requires_confirmation, confirmer_id, confirmed_at, record_date"
    )
    .eq("id", recordId)
    .eq("record_type", "EDU-001")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RawIepDetailRow;
  const content = row.content as IepInput;
  const personId = row.person_id;
  const academicYear = content?.academic_year ?? "";

  await logAccess(personId, "view", { recordId: row.id, domain: "EDU" });

  const [prevRes, obsRes] = await Promise.all([
    supabase
      .from("records")
      .select("id, content, record_date")
      .eq("person_id", personId)
      .eq("record_type", "EDU-001")
      .neq("id", recordId)
      .order("record_date", { ascending: false })
      .limit(20),
    supabase
      .from("records")
      .select("id, content, record_date")
      .eq("person_id", personId)
      .eq("record_type", "EDU-002")
      .order("record_date", { ascending: false })
      .limit(30),
  ]);

  // 이전 버전: academic_year가 현재보다 작은(과거) 것 중 가장 최근 record.
  let previousVersion: IepPreviousVersion | null = null;
  for (const r of (prevRes.data ?? []) as RawIepRow[]) {
    const c = r.content as IepInput;
    if (c?.academic_year && academicYear && c.academic_year < academicYear) {
      previousVersion = { recordId: r.id, academicYear: c.academic_year, content: c };
      break;
    }
  }

  // 목표 영역 라벨 집합(영역명 + "영역 · 목표") — 관찰기록의 느슨한 문자열 매칭 기준.
  const goalLabels = new Set<string>();
  for (const g of iepAnnualGoals(content)) {
    if (g.area) goalLabels.add(g.area);
    if (g.area && g.goal) goalLabels.add(`${g.area} · ${g.goal}`);
  }

  const linkedObservations: LinkedObservation[] = [];
  for (const r of (obsRes.data ?? []) as RawIepRow[]) {
    const c = r.content as ObservationInput;
    if (c?.linkedGoalArea && goalLabels.has(c.linkedGoalArea)) {
      linkedObservations.push({
        recordId: r.id,
        situation: c.situation ?? "",
        observedAt: c.observedAt ?? "",
        linkedGoalArea: c.linkedGoalArea,
        tags: Array.isArray(c.tags) ? c.tags : [],
      });
    }
    if (linkedObservations.length >= 5) break;
  }

  return {
    recordId: row.id,
    personId,
    content,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmerId: row.confirmer_id,
    confirmedAt: row.confirmed_at,
    recordDate: row.record_date,
    previousVersion,
    linkedObservations,
  };
}

/**
 * T-14 인라인 편집 — content.annual_goals[goalIndex]에 patch를 얕게 병합하고 나머지는 보존.
 * JSONB 전체를 읽어와 해당 인덱스만 갱신해 다시 쓴다. content 변경이므로 이미 확인된 IEP는
 * trg_reset_confirmation_on_edit(§4-6④)에 의해 재확인 대기로 돌아간다(의도된 동작).
 * UPDATE 권한은 records_update RLS(permissions edit 분기)가 강제한다.
 */
export async function updateIepGoal(
  recordId: string,
  goalIndex: number,
  patch: IepGoalPatch
): Promise<ActionResult> {
  if (!UUID_RE.test(recordId)) return { error: "기록 정보가 올바르지 않습니다." };
  if (!Number.isInteger(goalIndex) || goalIndex < 0) {
    return { error: "목표 위치가 올바르지 않습니다." };
  }
  const parsed = iepGoalPatchSchema.safeParse(patch);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { data: existing, error: selErr } = await supabase
    .from("records")
    .select("id, person_id, domain, content")
    .eq("id", recordId)
    .eq("record_type", "EDU-001")
    .maybeSingle();

  if (selErr || !existing) {
    return { error: "IEP를 찾을 수 없거나 접근 권한이 없습니다." };
  }

  const content = (existing.content ?? {}) as Record<string, unknown>;
  const goals = iepAnnualGoals(content).slice();
  if (goalIndex >= goals.length) return { error: "해당 목표를 찾을 수 없습니다." };

  goals[goalIndex] = { ...goals[goalIndex], ...parsed.data };
  const nextContent = { ...content, annual_goals: goals };

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
 * T-16 관찰기록 작성 — records INSERT(domain='EDU', record_type='EDU-002').
 * 일상 기록이라 requires_confirmation=false(§4-6). observedAt을 record_date로 쓰고,
 * 선택 태그는 content.tags와 records.tags 컬럼 양쪽에 저장한다(타임라인 tags[] 조회 일관성).
 */
export async function createObservation(
  input: ObservationInput & { personId: string }
): Promise<ActionResult & { recordId?: string }> {
  const { personId, ...content } = input;
  if (!UUID_RE.test(personId)) return { error: "학생 정보가 올바르지 않습니다." };

  const parsed = observationSchema.safeParse(content);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const observed = new Date(parsed.data.observedAt);
  const recordDate = Number.isNaN(observed.getTime())
    ? new Date().toISOString()
    : observed.toISOString();

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: "EDU",
      record_type: "EDU-002",
      content: parsed.data,
      tags: parsed.data.tags,
      is_draft: false,
      requires_confirmation: false,
      record_date: recordDate,
    })
    .select("id")
    .single();

  if (insErr) return { error: `관찰기록 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "EDU" });
  return { ok: true, recordId: row.id as string };
}

interface RawTimelineRow {
  id: string;
  domain: string;
  record_type: string;
  content: unknown;
  record_date: string;
  is_milestone: boolean | null;
  is_pinned: boolean | null;
  is_draft: boolean | null;
  tags: string[] | null;
}

/**
 * T-20 교육 타임라인 — 해당 학생 records 최신순(밀스톤 여부 포함, domain 필터 선택).
 * 접근 가능한 것만 RLS가 반환한다.
 */
export async function getTimeline(
  personId: string,
  domain?: DomainKey
): Promise<TimelineItem[]> {
  if (!UUID_RE.test(personId)) return [];

  let query = supabase
    .from("records")
    .select("id, domain, record_type, content, record_date, is_milestone, is_pinned, is_draft, tags")
    .eq("person_id", personId)
    .order("record_date", { ascending: false })
    .limit(100);
  if (domain) query = query.eq("domain", domain);

  const { data, error } = await query;
  if (error || !data) return [];

  return (data as RawTimelineRow[]).map((row) => ({
    id: row.id,
    domain: row.domain as DomainKey,
    recordType: row.record_type,
    title: recordDisplayTitle(row.record_type, row.content),
    date: row.record_date,
    isMilestone: Boolean(row.is_milestone),
    isPinned: Boolean(row.is_pinned),
    isDraft: Boolean(row.is_draft),
    tags: Array.isArray(row.tags) ? row.tags : [],
  }));
}
