import {
  isOptionalConsent,
  isRequiredConsent,
  type ConsentType,
  type Role,
} from "@ongil/validation";
import { supabase } from "./supabase";

/**
 * G-65(보호자) / P-23(당사자) 동의·권리 관리 — 모바일 데이터 접근.
 * 웹 Server Action(apps/web/src/app/(app)/settings/privacy/actions.ts)과 동일한 로직을
 * Supabase 직접 호출로 재현한다(RLS·컬럼권한에 위임).
 *
 * "회원탈퇴"는 계정 완전 삭제가 아니라 "동의 전체철회 + 계정 비활성화"(users.deactivated_at)다.
 * consents 는 append-only 원장 — 부여=INSERT, 철회=revoked_at UPDATE 만 사용한다.
 * withdrawAllConsentsAndDeactivate 성공 후 세션 종료(supabase.auth.signOut())는 호출부가 수행한다.
 */

export interface ConsentActionResult {
  ok?: boolean;
  error?: string;
}

export interface ConsentStatus {
  consentType: ConsentType;
  isAgreed: boolean;
  isRequired: boolean;
  agreedAt: string | null;
  revokedAt: string | null;
}

export interface ReacquisitionTarget {
  consentType: ConsentType;
}

export interface DataExport {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: Role | null;
    createdAt: string | null;
  };
  consents: {
    consentType: string;
    isAgreed: boolean;
    onBehalf: boolean;
    onBehalfOf: string | null;
    version: string;
    agreedAt: string | null;
    revokedAt: string | null;
    createdAt: string | null;
  }[];
  managedPersons: {
    id: string;
    fullName: string | null;
    birthDate: string | null;
    disabilityTypes: string[];
  }[];
}

/** 온보딩과 동일한 동의 버전 문자열 — 재동의도 같은 버전으로 기록한다. */
const CONSENT_VERSION = "v1.0";

type ConsentRow = {
  id: string;
  consent_type: string;
  is_agreed: boolean;
  on_behalf: boolean;
  on_behalf_of: string | null;
  version: string;
  agreed_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
};

/** consent_type 별 최신(created_at desc) 행만 남긴다. rows 는 created_at desc 정렬 전제. */
function latestPerType(rows: ConsentRow[]): Map<string, ConsentRow> {
  const latest = new Map<string, ConsentRow>();
  for (const row of rows) {
    if (!latest.has(row.consent_type)) latest.set(row.consent_type, row);
  }
  return latest;
}

async function getOwnPersonAdult(userId: string): Promise<boolean | null> {
  const { data } = await supabase
    .from("persons")
    .select("is_adult")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return Boolean(data.is_adult);
}

/** 본인 동의 현황 — consent_type 별 최신 행의 상태. */
export async function getMyConsentStatus(): Promise<ConsentStatus[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("consents")
    .select(
      "id, consent_type, is_agreed, on_behalf, on_behalf_of, version, agreed_at, revoked_at, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const latest = latestPerType(data as ConsentRow[]);
  return Array.from(latest.values()).map((row) => ({
    consentType: row.consent_type as ConsentType,
    isAgreed: Boolean(row.is_agreed),
    isRequired: isRequiredConsent(row.consent_type),
    agreedAt: row.agreed_at,
    revokedAt: row.revoked_at,
  }));
}

/** P-23 본인 동의 재취득 대상 — 성년 당사자가 아직 직접 재동의하지 않은 필수 항목. */
export async function getReacquisitionTargets(): Promise<ReacquisitionTarget[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "person") return [];

  const isAdult = await getOwnPersonAdult(user.id);
  if (isAdult !== true) return [];

  const { data, error } = await supabase
    .from("consents")
    .select(
      "id, consent_type, is_agreed, on_behalf, on_behalf_of, version, agreed_at, revoked_at, created_at"
    )
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const rows = data as ConsentRow[];

  const behalfLatest = latestPerType(
    rows.filter(
      (r) => r.on_behalf && r.on_behalf_of === user.id && r.revoked_at === null
    )
  );

  const ownLatest = new Map<string, string>();
  for (const r of rows) {
    if (!r.on_behalf && r.created_at && !ownLatest.has(r.consent_type)) {
      ownLatest.set(r.consent_type, r.created_at);
    }
  }

  const targets: ReacquisitionTarget[] = [];
  for (const [consentType, behalf] of behalfLatest) {
    const own = ownLatest.get(consentType);
    if (!own || (behalf.created_at && own < behalf.created_at)) {
      targets.push({ consentType: consentType as ConsentType });
    }
  }
  return targets;
}

/** 선택 동의 철회 — OPTIONAL 만 허용. 최신 미철회 행에 revoked_at 기록. */
export async function withdrawOptionalConsent(
  consentType: string
): Promise<ConsentActionResult> {
  if (!isOptionalConsent(consentType)) {
    return { error: "선택 동의만 철회할 수 있습니다." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: row } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", user.id)
    .eq("consent_type", consentType)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return { error: "철회할 동의가 없습니다." };
  }

  const { error } = await supabase
    .from("consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", row.id as string);
  if (error) {
    return { error: `동의 철회에 실패했습니다: ${error.message}` };
  }
  return { ok: true };
}

/** P-23 전용 — 성년 당사자 본인의 필수 동의 재취득(새 행 INSERT, on_behalf=false). */
export async function reacquireConsent(
  consentType: string
): Promise<ConsentActionResult> {
  if (!isRequiredConsent(consentType)) {
    return { error: "재취득 대상이 아닌 동의 유형입니다." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "person") {
    return { error: "당사자 본인만 동의를 재취득할 수 있습니다." };
  }

  const isAdult = await getOwnPersonAdult(user.id);
  if (isAdult !== true) {
    return { error: "성년이 된 당사자만 본인 동의를 재취득할 수 있습니다." };
  }

  const { error } = await supabase.from("consents").insert({
    user_id: user.id,
    consent_type: consentType,
    is_agreed: true,
    on_behalf: false,
    on_behalf_of: null,
    version: CONSENT_VERSION,
    agreed_at: new Date().toISOString(),
  });
  if (error) {
    return { error: `동의 재취득에 실패했습니다: ${error.message}` };
  }
  return { ok: true };
}

/**
 * 회원탈퇴 = 동의 전체철회 + 계정 비활성화. 성공 후 세션 종료는 호출부(supabase.auth.signOut())가 수행한다.
 */
export async function withdrawAllConsentsAndDeactivate(): Promise<ConsentActionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const now = new Date().toISOString();

  const { error: consentErr } = await supabase
    .from("consents")
    .update({ revoked_at: now })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if (consentErr) {
    return { error: `동의 철회에 실패했습니다: ${consentErr.message}` };
  }

  const { error: deactErr } = await supabase
    .from("users")
    .update({ deactivated_at: now })
    .eq("id", user.id);
  if (deactErr) {
    return { error: `계정 비활성화에 실패했습니다: ${deactErr.message}` };
  }
  return { ok: true };
}

/**
 * PIPA 열람권 — 본인 데이터 내보내기(JSON). 임상 기록(records) 원문은 포함하지 않는다(스코프 아님).
 */
export async function exportMyData(): Promise<DataExport | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: userRow } = await supabase
    .from("users")
    .select("id, email, full_name, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const { data: consentRows } = await supabase
    .from("consents")
    .select(
      "consent_type, is_agreed, on_behalf, on_behalf_of, version, agreed_at, revoked_at, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: personRows } = await supabase
    .from("persons")
    .select("id, full_name, birth_date, disability_types")
    .eq("primary_guardian_id", user.id);

  // 감사 로그(PIPA 열람권 행사 기록) — 웹 exportMyData와 동일하게 best-effort로 남긴다.
  try {
    await supabase.from("access_logs").insert({
      actor_id: user.id,
      person_id: user.id,
      action: "export",
    });
  } catch {
    // 감사 로그 실패는 내보내기 자체를 막지 않는다.
  }

  return {
    user: {
      id: user.id,
      email: (userRow?.email as string | undefined) ?? user.email ?? "",
      fullName: (userRow?.full_name as string | undefined) ?? null,
      role: (userRow?.role as Role | undefined) ?? null,
      createdAt: (userRow?.created_at as string | undefined) ?? null,
    },
    consents: (consentRows ?? []).map((r) => ({
      consentType: r.consent_type as string,
      isAgreed: Boolean(r.is_agreed),
      onBehalf: Boolean(r.on_behalf),
      onBehalfOf: (r.on_behalf_of as string | null) ?? null,
      version: r.version as string,
      agreedAt: (r.agreed_at as string | null) ?? null,
      revokedAt: (r.revoked_at as string | null) ?? null,
      createdAt: (r.created_at as string | null) ?? null,
    })),
    managedPersons: (personRows ?? []).map((p) => ({
      id: p.id as string,
      fullName: (p.full_name as string | undefined) ?? null,
      birthDate: (p.birth_date as string | undefined) ?? null,
      disabilityTypes: (p.disability_types as string[] | undefined) ?? [],
    })),
  };
}
