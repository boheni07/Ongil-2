"use server";

import {
  permissionGrantSchema,
  type PermissionGrantInput,
  type DomainKey,
  type AccessLevel,
  type Role,
} from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * G-30 권한 매트릭스 + G-32 권한 부여 4단계 위저드 Server Action 모음.
 * docs/04-workflow.md Flow-G-02, docs/05-erd.md §2-4 / §4-3 / §4-5, docs/01-prd.md §3-2~3-3.
 *
 * 방어 계층:
 *  - 실제 접근 통제는 permissions_write RLS(§4-3, 주보호자 FOR ALL)가 강제한다.
 *  - 여기서 assertPrimaryGuardian로 사전 체크하는 것은 오직 UX 에러 메시지를 위해서다
 *    (RLS 거부는 사용자에게 불친절한 메시지로 나오므로). 새 RLS는 만들지 않는다.
 *  - permission_logs는 trg_permission_audit 트리거(§4-5②)가 자동 기록하므로 직접 쓰지 않는다.
 *
 * edit-레벨 유효기간 가드레일(PRD §3-3 "edit는 무기한 금지"):
 *  - grantPermission: permissionGrantSchema.refine가 제출 시점에 강제.
 *  - cyclePermissionCell: 위저드를 우회하는 빠른 순환에서도 edit 진입 시 valid_until을 자동 부여.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** preset이 없는 role+domain 조합에서 edit로 순환 진입할 때 쓰는 기본 유효기간(일). */
const EDIT_FALLBACK_VALID_DAYS = 90;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

export interface GrantResult extends ActionResult {
  /** true면 미가입자 초대(invitations)로 처리됨, false/undefined면 즉시 권한 부여. */
  invited?: boolean;
}

export interface PermissionPreset {
  domain: DomainKey;
  accessLevel: AccessLevel;
  defaultValidDays: number | null;
}

export interface GranteeSummary {
  id: string;
  fullName: string;
  role: Role;
}

export interface PermissionCell {
  accessLevel: AccessLevel;
  validUntil: string | null;
}

export interface PermissionMatrixRow {
  granteeId: string;
  granteeName: string;
  granteeRole: Role;
  cells: Partial<Record<DomainKey, PermissionCell>>;
}

/** none을 포함한 셀 순환 단계 — 회색(없음)→read→write→edit→회색 (PRD §3-3 "수정"). */
export type CellLevel = "none" | AccessLevel;

export interface CycleResult extends ActionResult {
  newLevel: CellLevel;
}

const CYCLE_ORDER: CellLevel[] = ["none", "read", "write", "edit"];

function nextLevel(current: CellLevel): CellLevel {
  const i = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(i + 1) % CYCLE_ORDER.length];
}

/** YYYY-MM-DD 오늘+days */
function dateFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * 인증된 사용자가 personId의 주보호자인지 확인(§4-3 permissions_write와 동일 조건).
 * 반환: { user } — 통과 시 user, 아니면 error.
 */
async function requirePrimaryGuardian(
  supabase: SupabaseClient,
  personId: string
): Promise<{ userId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data, error } = await supabase
    .from("guardians")
    .select("id")
    .eq("person_id", personId)
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (error || !data) {
    return { error: "권한을 관리할 수 있는 주보호자만 접근할 수 있습니다." };
  }
  return { userId: user.id };
}

/**
 * G-32 Step2 진입 시 대상자 role로 프리셋 조회 — 도메인 자동 선택 + 기본 수준/기간 프리필.
 * person/guardian은 프리셋 대상이 아니라 빈 배열이 반환된다.
 */
export async function getPermissionPresets(role: Role): Promise<PermissionPreset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permission_presets")
    .select("domain, access_level, default_valid_days")
    .eq("role", role);

  if (error || !data) return [];
  return data.map((r) => ({
    domain: r.domain as DomainKey,
    accessLevel: r.access_level as AccessLevel,
    defaultValidDays: (r.default_valid_days as number | null) ?? null,
  }));
}

/**
 * G-32 Step1 "대상자 선택" — 이메일로 기존 가입자 조회. 없으면 null(→ 초대 흐름).
 * users_select RLS 범위 내에서만 조회된다.
 */
export async function findGranteeByEmail(email: string): Promise<GranteeSummary | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("email", normalized)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    fullName: data.full_name as string,
    role: data.role as Role,
  };
}

/**
 * G-30 매트릭스 — personId의 활성 권한을 grantee별로 그룹핑해 users join.
 * 비활성/미부여 셀은 반환하지 않는다(UI가 없는 셀을 "회색(없음)"으로 렌더). §4-5③ 자동 만료가
 * is_active=false로 내리므로 활성만 조회하면 매트릭스가 실효 권한을 정확히 반영한다.
 */
export async function getPermissionMatrix(personId: string): Promise<PermissionMatrixRow[]> {
  if (!UUID_RE.test(personId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("grantee_id, domain, access_level, valid_until, grantee:users!permissions_grantee_id_fkey(full_name, role)")
    .eq("person_id", personId)
    .eq("is_active", true);

  if (error || !data) return [];

  const rows = new Map<string, PermissionMatrixRow>();
  for (const p of data) {
    const granteeId = p.grantee_id as string;
    const grantee = p.grantee as { full_name: string; role: Role } | { full_name: string; role: Role }[] | null;
    const g = Array.isArray(grantee) ? grantee[0] : grantee;

    let row = rows.get(granteeId);
    if (!row) {
      row = {
        granteeId,
        granteeName: g?.full_name ?? "알 수 없음",
        granteeRole: (g?.role as Role) ?? "supporter",
        cells: {},
      };
      rows.set(granteeId, row);
    }
    row.cells[p.domain as DomainKey] = {
      accessLevel: p.access_level as AccessLevel,
      validUntil: (p.valid_until as string | null) ?? null,
    };
  }
  return [...rows.values()];
}

/**
 * G-30 셀 클릭 순환 — 회색→read→write→edit→회색 (PRD §3-3 "수정"·"즉시 회수").
 * 현재 상태를 조회해 다음 상태를 계산하고 permissions에 UPSERT하거나 is_active=false로 회수한다.
 * edit로 순환 진입 시 valid_until이 없으면 preset(role+domain) default_valid_days를,
 * 없으면 EDIT_FALLBACK_VALID_DAYS(90일)를 자동 적용해 "edit 무기한 금지" 가드레일을 지킨다.
 */
export async function cyclePermissionCell(
  personId: string,
  granteeId: string,
  domain: DomainKey
): Promise<CycleResult> {
  if (!UUID_RE.test(personId) || !UUID_RE.test(granteeId)) {
    return { error: "대상 정보가 올바르지 않습니다.", newLevel: "none" };
  }

  const supabase = await createClient();
  const guard = await requirePrimaryGuardian(supabase, personId);
  if ("error" in guard) return { error: guard.error, newLevel: "none" };

  // 현재 상태 조회 (비활성 행이 있으면 재활성화 대상)
  const { data: existing } = await supabase
    .from("permissions")
    .select("access_level, is_active, valid_until")
    .eq("person_id", personId)
    .eq("grantee_id", granteeId)
    .eq("domain", domain)
    .maybeSingle();

  const current: CellLevel =
    existing && existing.is_active ? (existing.access_level as AccessLevel) : "none";
  const target = nextLevel(current);

  // edit→none: 즉시 회수
  if (target === "none") {
    const { error } = await supabase
      .from("permissions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("person_id", personId)
      .eq("grantee_id", granteeId)
      .eq("domain", domain);
    if (error) return { error: `회수에 실패했습니다: ${error.message}`, newLevel: current };
    return { ok: true, newLevel: "none" };
  }

  // read/write/edit: UPSERT. edit 진입 시 valid_until 자동 부여(가드레일).
  let validUntil: string | null =
    (existing?.valid_until as string | null) ?? null;
  if (target === "edit") {
    const keepExisting =
      validUntil !== null && validUntil >= new Date().toISOString().slice(0, 10);
    if (!keepExisting) {
      const granteeRole = await getGranteeRole(supabase, granteeId);
      const days = granteeRole
        ? await presetValidDays(supabase, granteeRole, domain)
        : null;
      validUntil = dateFromNow(days ?? EDIT_FALLBACK_VALID_DAYS);
    }
  }

  const { error } = await supabase.from("permissions").upsert(
    {
      person_id: personId,
      grantee_id: granteeId,
      domain,
      access_level: target,
      is_active: true,
      valid_until: validUntil,
      granted_by: guard.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "person_id,grantee_id,domain" }
  );
  if (error) return { error: `권한 변경에 실패했습니다: ${error.message}`, newLevel: current };
  return { ok: true, newLevel: target };
}

async function getGranteeRole(
  supabase: SupabaseClient,
  granteeId: string
): Promise<Role | null> {
  const { data } = await supabase.from("users").select("role").eq("id", granteeId).maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

async function presetValidDays(
  supabase: SupabaseClient,
  role: Role,
  domain: DomainKey
): Promise<number | null> {
  const { data } = await supabase
    .from("permission_presets")
    .select("default_valid_days")
    .eq("role", role)
    .eq("domain", domain)
    .maybeSingle();
  return (data?.default_valid_days as number | null) ?? null;
}

/**
 * G-32 최종 제출(Flow-G-02 4단계).
 * - target='existing': 각 도메인에 대해 permissions UPSERT(즉시 부여).
 * - target='invite'  : invitations INSERT(수락 시 accept_invitation이 permissions로 전개).
 * edit-레벨 유효기간 가드레일은 permissionGrantSchema.refine가 이미 강제한다.
 */
export async function grantPermission(
  personId: string,
  input: PermissionGrantInput
): Promise<GrantResult> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = permissionGrantSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const guard = await requirePrimaryGuardian(supabase, personId);
  if ("error" in guard) return { error: guard.error };

  if (data.target === "invite") {
    const { error } = await supabase.from("invitations").insert({
      person_id: personId,
      inviter_id: guard.userId,
      invitee_email: data.inviteEmail.trim().toLowerCase(),
      role: data.inviteRole,
      domain_grants: data.domains.map((d) => ({
        domain: d.domain,
        access_level: d.accessLevel,
      })),
      valid_until: data.validUntil,
    });
    if (error) return { error: `초대 발송에 실패했습니다: ${error.message}` };
    return { ok: true, invited: true };
  }

  // target === 'existing' — 각 도메인 UPSERT
  const rows = data.domains.map((d) => ({
    person_id: personId,
    grantee_id: data.granteeUserId,
    domain: d.domain,
    access_level: d.accessLevel,
    is_active: true,
    valid_until: data.validUntil,
    granted_by: guard.userId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("permissions")
    .upsert(rows, { onConflict: "person_id,grantee_id,domain" });
  if (error) return { error: `권한 부여에 실패했습니다: ${error.message}` };
  return { ok: true, invited: false };
}

/**
 * 명시적 즉시 회수(§4-3, PRD §3-3 "즉시 회수") — 매트릭스의 별도 회수 버튼용.
 * cyclePermissionCell이 회색에 도달했을 때와 동일 효과(is_active=false)의 명시적 버전.
 */
export async function revokePermission(
  personId: string,
  granteeId: string,
  domain: DomainKey
): Promise<ActionResult> {
  if (!UUID_RE.test(personId) || !UUID_RE.test(granteeId)) {
    return { error: "대상 정보가 올바르지 않습니다." };
  }

  const supabase = await createClient();
  const guard = await requirePrimaryGuardian(supabase, personId);
  if ("error" in guard) return { error: guard.error };

  const { error } = await supabase
    .from("permissions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("person_id", personId)
    .eq("grantee_id", granteeId)
    .eq("domain", domain);
  if (error) return { error: `회수에 실패했습니다: ${error.message}` };
  return { ok: true };
}
