"use server";

import { headers } from "next/headers";
import {
  personRegisterSchema,
  personUpdateSchema,
  recordDisplayTitle,
  RECORD_TYPE_LABEL,
  type PersonRegisterInput,
  type PersonUpdateInput,
} from "@ongil/validation";
import type { Role } from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";

/**
 * P1-5 보호자 대시보드 (G-01) + 당사자 등록 6단계(Flow-G-01) Server Action 모음.
 *
 * registerPerson은 3개 테이블에 순차 INSERT한다(단일 트랜잭션은 supabase-js에서 불가):
 *   1) persons — 주보호자 = 생성자
 *   2) guardians — user_id=생성자, is_primary=true. **필수**: 이게 없으면 생성자 본인이
 *      방금 만든 당사자의 records/permissions에 RLS(EXISTS guardians)로 접근하지 못한다.
 *   3) consents — Step2 민감정보 대리 동의(on_behalf=true, on_behalf_of=신규 person)
 * 2)가 실패하면 1)에서 만든 persons를 롤백 삭제해 고아 레코드를 방지한다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

export interface RegisterPersonResult {
  ok?: boolean;
  error?: string;
  personId?: string;
}

/** G-01 PersonCard 슬라이더 항목 */
export interface GuardianPerson {
  id: string;
  fullName: string;
  birthDate: string;
  gender: "M" | "F" | "other" | null;
  disabilityTypes: string[];
  disabilityDegree: "severe" | "mild" | null;
  emergencyInfo: unknown;
  avatarUrl: string | null;
  isAdult: boolean;
}

/** 역할 → 한글 라벨(권한 현황 카드용). 다른 화면(PermissionGrantWizard 등)의 동일 상수와 값이 같다. */
const ROLE_LABEL: Record<string, string> = {
  guardian: "보호자",
  person: "당사자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

/** access_level 우선순위(높을수록 강한 권한) — 그란티가 도메인별로 여러 건 보유해도 카드엔 1행만. */
const ACCESS_LEVEL_RANK: Record<string, number> = { read: 1, write: 2, edit: 3 };

/** G-01 "최근 기록" 카드 한 행 — 기록명(recordDisplayTitle)·작성자까지 포함(2026-07-19, docs/12 Wave A). */
export interface RecentRecordItem {
  id: string;
  domain: string;
  recordType: string;
  title: string;
  authorName: string | null;
  recordDate: string;
}

/** G-01 "권한 현황" 카드 한 행 — 그란티 1명당 1행(다중 도메인 보유 시 가장 강한 access_level만). */
export interface PermissionSummaryItem {
  granteeId: string;
  granteeName: string | null;
  granteeRole: string | null;
  accessLevel: string;
}

/** G-01 "확인 대기 기록" 카드 한 행. */
export interface PendingConfirmationItem {
  id: string;
  domain: string;
  title: string;
  authorName: string | null;
  recordDate: string;
}

/** G-01 요약 카드 데이터(2026-07-19, docs/12 Wave A — count만 반환하던 것을 실제 목록으로 확장). */
export interface PersonSummaryCards {
  personId: string;
  recentRecords: RecentRecordItem[];
  permissions: PermissionSummaryItem[];
  permissionCount: number;
  pendingConfirmations: PendingConfirmationItem[];
  pendingConfirmationCount: number;
}

/** G-01 "알림" 카드 한 행. */
export interface RecentNotificationItem {
  id: string;
  title: string;
  body: string | null;
  sentAt: string;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/**
 * Flow-G-01 당사자 등록 — persons → guardians → consents 순차 INSERT.
 * 생성자는 guardian 역할이어야 한다(persons_insert RLS도 동일하게 강제).
 */
export async function registerPerson(input: PersonRegisterInput): Promise<RegisterPersonResult> {
  const parsed = personRegisterSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "guardian") {
    return { error: "보호자 계정만 당사자를 등록할 수 있습니다." };
  }

  const { fullName, birthDate, gender, disabilityTypes, disabilityDegree, emergencyInfo, avatarUrl } =
    parsed.data;

  // 1) persons
  const { data: person, error: personErr } = await supabase
    .from("persons")
    .insert({
      primary_guardian_id: user.id,
      full_name: fullName,
      birth_date: birthDate,
      gender: gender ?? null,
      disability_types: disabilityTypes,
      disability_degree: disabilityDegree ?? null,
      emergency_info: emergencyInfo ?? null,
      avatar_url: avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (personErr || !person) {
    return { error: `당사자 등록에 실패했습니다: ${personErr?.message ?? "알 수 없는 오류"}` };
  }
  const personId = person.id as string;

  // 2) guardians (필수 — 실패 시 persons 롤백)
  const { error: guardianErr } = await supabase.from("guardians").insert({
    user_id: user.id,
    person_id: personId,
    is_primary: true,
  });
  if (guardianErr) {
    await supabase.from("persons").delete().eq("id", personId);
    return { error: `보호자 관계 생성에 실패했습니다: ${guardianErr.message}` };
  }

  // 3) consents — 민감정보 대리 동의(§2-8). 실패해도 등록 자체는 성립시키되 오류를 알린다.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { error: consentErr } = await supabase.from("consents").insert({
    user_id: user.id,
    consent_type: "sensitive",
    is_agreed: true,
    on_behalf: true,
    on_behalf_of: personId,
    version: "v1.0",
    agreed_at: new Date().toISOString(),
    ip_address: ip,
  });
  if (consentErr) {
    return {
      ok: true,
      personId,
      error: `등록은 완료됐지만 민감정보 동의 기록 저장에 실패했습니다: ${consentErr.message}`,
    };
  }

  return { ok: true, personId };
}

const AVATAR_BUCKET = "person-avatars";
const AVATAR_MAX_SIZE = 5242880; // 5 MiB (버킷 file_size_limit과 동일)
const AVATAR_ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

export interface UploadAvatarResult {
  ok?: boolean;
  error?: string;
  url?: string;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-100) || "photo";
}

/**
 * Flow-G-01 Step5 프로필 사진 업로드. 당사자 등록 시점엔 아직 persons 행이 없어
 * person_id로 스코프할 수 없으므로 업로더(보호자) 자신의 폴더 `{user.id}/...`에 올린다
 * (마이그레이션 20260719020000의 storage.objects RLS와 동일 규칙).
 * 공개 버킷이라 업로드 직후 안정된 공개 URL을 바로 돌려줄 수 있다(presigned URL 불필요).
 */
export async function uploadPersonAvatar(formData: FormData): Promise<UploadAvatarResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "업로드할 사진을 선택해주세요." };
  }
  if (file.size > AVATAR_MAX_SIZE) {
    return { error: "사진 크기는 5MB를 초과할 수 없습니다." };
  }
  if (!AVATAR_ALLOWED_MIME.includes(file.type)) {
    return { error: `허용되지 않는 형식입니다 (${file.type || "unknown"}). PNG/JPEG/WebP 이미지만 가능합니다.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "guardian") {
    return { error: "보호자 계정만 사진을 업로드할 수 있습니다." };
  }

  const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    return { error: `업로드 실패: ${upErr.message}` };
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/**
 * G-01 대시보드 — 보호자가 접근 가능한 당사자 목록(응급정보 포함).
 * persons_select RLS가 접근 범위를 강제한다. 서버 컴포넌트에서 직접 호출.
 */
export async function getGuardianPersons(): Promise<GuardianPerson[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("persons")
    .select(
      "id, full_name, birth_date, gender, disability_types, disability_degree, emergency_info, avatar_url, is_adult"
    )
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    fullName: row.full_name as string,
    birthDate: row.birth_date as string,
    gender: (row.gender as GuardianPerson["gender"]) ?? null,
    disabilityTypes: (row.disability_types as string[] | null) ?? [],
    disabilityDegree: (row.disability_degree as GuardianPerson["disabilityDegree"]) ?? null,
    emergencyInfo: row.emergency_info ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    isAdult: Boolean(row.is_adult),
  }));
}

/**
 * 당사자 정보 수정(2026-07-19) — persons UPDATE. RLS(persons_update, 신설)는 guardians
 * 관계 보유자 전원(주보호자·공동보호자 모두)에게 열려 있고, 위조 방지를 위해 컬럼 권한을
 * full_name/birth_date/gender/disability_types/disability_degree/emergency_info/
 * avatar_url/updated_at으로만 제한한다(primary_guardian_id·is_adult·id는 이 경로로 절대
 * 못 바꾼다 — 마이그레이션 p3_persons_update_rls 참고).
 */
export async function updateGuardianPerson(
  personId: string,
  input: PersonUpdateInput
): Promise<ActionResult> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = personUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { fullName, birthDate, gender, disabilityTypes, disabilityDegree, emergencyInfo, avatarUrl } =
    parsed.data;

  const { error } = await supabase
    .from("persons")
    .update({
      full_name: fullName,
      birth_date: birthDate,
      gender: gender ?? null,
      disability_types: disabilityTypes,
      disability_degree: disabilityDegree ?? null,
      emergency_info: emergencyInfo ?? null,
      avatar_url: avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", personId);

  if (error) {
    return { error: `당사자 정보 수정에 실패했습니다: ${error.message}` };
  }
  return { ok: true };
}

/**
 * 피보호자 목록에서 제외(2026-07-19) — 이 보호자 본인의 guardians 링크만 삭제한다(다른
 * 이해관계자가 작성한 당사자 기록은 그대로 남는다, persons/records 자체는 건드리지 않음).
 * RLS(guardians_delete, 신설)가 "주보호자(is_primary=true)는 삭제 불가"를 강제한다 —
 * persons.primary_guardian_id가 ON DELETE RESTRICT라 주보호자 링크를 지우면 정합성이
 * 깨지기 때문(주보호자 재지정은 별도 기능, 이번 범위 밖). 그 경우 이 함수는 0행 삭제로
 * 조용히 실패하므로 명시적으로 감지해 안내 메시지를 준다.
 */
export async function removeGuardianPerson(personId: string): Promise<ActionResult> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data, error } = await supabase
    .from("guardians")
    .delete()
    .eq("person_id", personId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    return { error: `목록에서 제외하지 못했습니다: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return {
      error: "주보호자는 목록에서 제외할 수 없습니다. 먼저 다른 보호자를 주보호자로 지정해주세요.",
    };
  }
  return { ok: true };
}

/**
 * G-01 요약 카드 — 특정 당사자의 최근 기록 5건 + 활성 권한 개수.
 * RLS로 접근 가능한 데이터만 반환된다.
 */
function pickName(rel: unknown): string | null {
  const r = rel as { full_name?: string } | { full_name?: string }[] | null;
  if (Array.isArray(r)) return r[0]?.full_name ?? null;
  return r?.full_name ?? null;
}

function pickRole(rel: unknown): string | null {
  const r = rel as { role?: string } | { role?: string }[] | null;
  if (Array.isArray(r)) return r[0]?.role ?? null;
  return r?.role ?? null;
}

export async function getPersonSummaryCards(personId: string): Promise<PersonSummaryCards> {
  const empty: PersonSummaryCards = {
    personId,
    recentRecords: [],
    permissions: [],
    permissionCount: 0,
    pendingConfirmations: [],
    pendingConfirmationCount: 0,
  };
  if (!UUID_RE.test(personId)) return empty;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const [recordsRes, permsRes, pendingRes] = await Promise.all([
    supabase
      .from("records")
      .select("id, domain, record_type, content, record_date, author:users!author_id(full_name)")
      .eq("person_id", personId)
      .eq("is_draft", false)
      .order("record_date", { ascending: false })
      .limit(5),
    supabase
      .from("permissions")
      .select("grantee_id, access_level, grantee:users!grantee_id(full_name, role)")
      .eq("person_id", personId)
      .eq("is_active", true),
    supabase
      .from("records")
      .select("id, domain, record_type, content, author:users!author_id(full_name), record_date")
      .eq("person_id", personId)
      .eq("requires_confirmation", true)
      .is("confirmed_at", null)
      .order("record_date", { ascending: false })
      .limit(5),
  ]);

  const recentRecords: RecentRecordItem[] = (recordsRes.data ?? []).map((row) => ({
    id: row.id as string,
    domain: row.domain as string,
    recordType: row.record_type as string,
    title: recordDisplayTitle(row.record_type as string, row.content),
    authorName: pickName(row.author),
    recordDate: row.record_date as string,
  }));

  // 그란티 1명이 도메인별로 여러 permissions 행을 가질 수 있다 — 카드엔 1행만 보여주므로
  // 가장 강한 access_level(edit > write > read)로 병합한다.
  const permMap = new Map<string, PermissionSummaryItem>();
  for (const row of permsRes.data ?? []) {
    const granteeId = row.grantee_id as string;
    const level = row.access_level as string;
    const existing = permMap.get(granteeId);
    if (!existing || (ACCESS_LEVEL_RANK[level] ?? 0) > (ACCESS_LEVEL_RANK[existing.accessLevel] ?? 0)) {
      permMap.set(granteeId, {
        granteeId,
        granteeName: pickName(row.grantee),
        granteeRole: pickRole(row.grantee),
        accessLevel: level,
      });
    }
  }
  const permissions = [...permMap.values()];

  const pendingConfirmations: PendingConfirmationItem[] = (pendingRes.data ?? []).map((row) => ({
    id: row.id as string,
    domain: row.domain as string,
    title: recordDisplayTitle(row.record_type as string, row.content),
    authorName: pickName(row.author),
    recordDate: row.record_date as string,
  }));

  return {
    personId,
    recentRecords,
    permissions,
    permissionCount: permissions.length,
    pendingConfirmations,
    pendingConfirmationCount: pendingConfirmations.length,
  };
}

/** G-01 "알림" 카드 — 로그인 계정(recipient_id) 기준 최근 알림(당사자 무관, 2026-07-19 docs/12 Wave A). */
export async function getRecentNotifications(limit = 3): Promise<RecentNotificationItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, sent_at")
    .eq("recipient_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    sentAt: row.sent_at as string,
  }));
}

/** G-01 당사자 카드 상단 통계 3종(이번주 기록 수·권한 부여 건수·다음 공식문서 점검 D-day). */
export interface PersonCardStats {
  weeklyRecordCount: number;
  permissionCount: number;
  nextReview: { label: string; dday: number } | null;
}

/** 다음 검토일 필드를 가진 공식 문서 record_type — 값 도달 시 해당 문서명으로 D-day 라벨을 만든다. */
const REVIEW_DATE_RECORD_TYPES: { recordType: string; field: string }[] = [
  { recordType: "WEL-004", field: "reassessment_date" }, // ISP
  { recordType: "TRA-001", field: "next_review_date" }, // 전환계획
  { recordType: "EDU-005", field: "next_review_date" }, // ITP
  { recordType: "EDU-003", field: "review_date" }, // BIP
];

/**
 * 여러 당사자의 카드 상단 통계를 한 번에 계산한다(대시보드 슬라이더용, N+1 방지 위해 배치 조회).
 * "다음 공식문서 점검 D-day"는 도메인마다 필드가 달라(ISP=reassessment_date, 전환계획/ITP=
 * next_review_date, BIP=review_date) 이 당사자에게 존재하는 문서 중 아직 지나지 않은 날짜가
 * 가장 임박한 것을 자동 선택한다(2026-07-19, docs/12 Wave A — 사용자 확인 후 채택한 방식).
 */
export async function getPersonCardStats(personIds: string[]): Promise<Record<string, PersonCardStats>> {
  const result: Record<string, PersonCardStats> = {};
  if (personIds.length === 0) return result;

  const supabase = await createClient();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [weeklyRes, permsRes, reviewRes] = await Promise.all([
    supabase
      .from("records")
      .select("person_id")
      .in("person_id", personIds)
      .eq("is_draft", false)
      .gte("record_date", weekStart.toISOString()),
    supabase
      .from("permissions")
      .select("person_id, grantee_id")
      .in("person_id", personIds)
      .eq("is_active", true),
    supabase
      .from("records")
      .select("person_id, record_type, content")
      .in("person_id", personIds)
      .in(
        "record_type",
        REVIEW_DATE_RECORD_TYPES.map((r) => r.recordType)
      )
      .eq("is_draft", false),
  ]);

  const weeklyCount = new Map<string, number>();
  for (const row of weeklyRes.data ?? []) {
    const pid = row.person_id as string;
    weeklyCount.set(pid, (weeklyCount.get(pid) ?? 0) + 1);
  }

  const permCount = new Map<string, Set<string>>();
  for (const row of permsRes.data ?? []) {
    const pid = row.person_id as string;
    if (!permCount.has(pid)) permCount.set(pid, new Set());
    permCount.get(pid)!.add(row.grantee_id as string);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextReview = new Map<string, { label: string; dday: number }>();
  for (const row of reviewRes.data ?? []) {
    const pid = row.person_id as string;
    const recordType = row.record_type as string;
    const spec = REVIEW_DATE_RECORD_TYPES.find((r) => r.recordType === recordType);
    if (!spec) continue;
    const content = row.content as Record<string, unknown> | null;
    const dateStr = content?.[spec.field];
    if (typeof dateStr !== "string") continue;
    const due = new Date(dateStr);
    if (Number.isNaN(due.getTime())) continue;
    const dday = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (dday < 0) continue;
    const existing = nextReview.get(pid);
    if (!existing || dday < existing.dday) {
      nextReview.set(pid, { label: `${RECORD_TYPE_LABEL[recordType] ?? recordType} 점검`, dday });
    }
  }

  for (const pid of personIds) {
    result[pid] = {
      weeklyRecordCount: weeklyCount.get(pid) ?? 0,
      permissionCount: permCount.get(pid)?.size ?? 0,
      nextReview: nextReview.get(pid) ?? null,
    };
  }
  return result;
}
