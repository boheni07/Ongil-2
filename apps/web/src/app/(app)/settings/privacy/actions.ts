"use server";

import {
  isOptionalConsent,
  isRequiredConsent,
  type ConsentType,
} from "@ongil/validation";
import type { Role } from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";

/**
 * G-65(보호자) / P-23(당사자) 동의·권리 관리 — 라우트 /settings/privacy 서버 액션.
 *
 * 스코프(사용자 확정): "회원탈퇴"는 계정 완전 삭제가 아니라 "동의 전체철회 + 계정 비활성화"다.
 * users/persons 행을 삭제하지 않는다(다른 이해관계자가 작성한 당사자 기록 연쇄 삭제 위험).
 * 비활성화는 users.deactivated_at 타임스탬프로만 표현한다(마이그레이션 20260714020000).
 *
 * consents 는 append-only 원장이다(불변 감사, docs/05-erd.md §4-7):
 *   - 현재 상태 = consent_type 별 가장 최근(created_at desc) 행
 *   - 동의 부여 = 새 행 INSERT, 철회 = 해당 행의 revoked_at UPDATE 만 허용
 *   - 그 외 컬럼 UPDATE·DELETE 는 RLS/컬럼권한으로 차단됨(여기서도 절대 시도하지 않는다)
 */

export interface ActionResult {
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

/** 온보딩(insertSignupConsents)과 동일한 버전 문자열 — 재동의도 같은 버전으로 기록한다. */
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

/**
 * consent_type 별 "가장 최근(created_at desc) 행"만 남긴다. rows 는 created_at desc 정렬 전제.
 * append-only 원장에서 최신 행이 곧 현재 상태다.
 */
function latestPerType(rows: ConsentRow[]): Map<string, ConsentRow> {
  const latest = new Map<string, ConsentRow>();
  for (const row of rows) {
    if (!latest.has(row.consent_type)) latest.set(row.consent_type, row);
  }
  return latest;
}

/** P-23 재취득 판정을 위해 person 본인의 성년 여부를 조회한다. person 행이 없으면 null. */
async function getOwnPersonAdult(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean | null> {
  const { data } = await supabase
    .from("persons")
    .select("is_adult")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return Boolean(data.is_adult);
}

/**
 * 본인의 동의 현황 — consent_type 별 최신 행의 상태. G-65/P-23 목록 렌더링용.
 * revoked_at 이 있으면 철회된 것으로 간주(isAgreed 는 원본 행 값 그대로 반환).
 */
export async function getMyConsentStatus(): Promise<ConsentStatus[]> {
  const supabase = await createClient();
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

/**
 * P-23 본인 동의 재취득 대상 — 성년이 된 당사자 본인이 아직 직접 재동의하지 않은 필수 항목.
 *
 * 판정: person 역할 + 자신의 persons.is_adult=true 일 때만 의미가 있다(그 외엔 빈 배열).
 * 보호자가 대리 동의(on_behalf=true, on_behalf_of=본인 person_id)한 미철회 항목 중,
 * 본인(user_id=auth.uid())이 on_behalf=false 로 더 최근에 INSERT 한 재동의 행이 없는 타입만 남긴다.
 *
 * ※ 셀프 가입 성인(persons.id=primary_guardian_id=auth.uid())은 대리동의 자체가 없어
 *   자연히 빈 목록이 된다(정상). consents_select RLS(user_id=auth.uid())상 타인(보호자)이
 *   기록한 대리동의 행은 본인에게 보이지 않을 수 있으므로, 여기서는 "본인에게 보이는 대리동의"
 *   기준으로 계산한다 — 안전한 축소(과다 노출 없음) 방향이다.
 */
export async function getReacquisitionTargets(): Promise<ReacquisitionTarget[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "person") return [];

  const isAdult = await getOwnPersonAdult(supabase, user.id);
  if (isAdult !== true) return [];

  const { data, error } = await supabase
    .from("consents")
    .select(
      "id, consent_type, is_agreed, on_behalf, on_behalf_of, version, agreed_at, revoked_at, created_at"
    )
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const rows = data as ConsentRow[];

  // 보호자 대리동의(on_behalf=true, on_behalf_of=본인, 미철회) — 타입별 최신 행
  const behalfLatest = latestPerType(
    rows.filter(
      (r) => r.on_behalf && r.on_behalf_of === user.id && r.revoked_at === null
    )
  );

  // 본인이 직접(on_behalf=false, user_id=본인) 재동의한 행 — 타입별 최신 created_at
  const ownLatest = new Map<string, string>();
  for (const r of rows) {
    if (!r.on_behalf && r.created_at && !ownLatest.has(r.consent_type)) {
      ownLatest.set(r.consent_type, r.created_at);
    }
  }

  const targets: ReacquisitionTarget[] = [];
  for (const [consentType, behalf] of behalfLatest) {
    const own = ownLatest.get(consentType);
    // 본인 재동의가 없거나, 대리동의보다 오래됐으면 아직 재취득 대상
    if (!own || (behalf.created_at && own < behalf.created_at)) {
      targets.push({ consentType: consentType as ConsentType });
    }
  }
  return targets;
}

/**
 * 선택 동의 철회 — marketing 등 OPTIONAL 만 허용. 필수 동의는 서비스 이용 전제라 이 경로로
 * 철회할 수 없다(전체철회+탈퇴로만 가능). 해당 타입의 가장 최근 미철회 행에 revoked_at 기록.
 */
export async function withdrawOptionalConsent(
  consentType: string
): Promise<ActionResult> {
  if (!isOptionalConsent(consentType)) {
    return { error: "선택 동의만 철회할 수 있습니다." };
  }

  const supabase = await createClient();
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

/**
 * P-23 전용 — 성년이 된 당사자 본인의 필수 동의 재취득. 새 consents 행 INSERT(본인 명의,
 * on_behalf=false). is_adult 강제는 RLS 대상이 아니므로(consents_insert 는 user_id 만 검증)
 * 서버에서 person.is_adult 를 확인한 뒤에만 진행한다.
 */
export async function reacquireConsent(consentType: string): Promise<ActionResult> {
  if (!isRequiredConsent(consentType)) {
    return { error: "재취득 대상이 아닌 동의 유형입니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "person") {
    return { error: "당사자 본인만 동의를 재취득할 수 있습니다." };
  }

  const isAdult = await getOwnPersonAdult(supabase, user.id);
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
 * 회원탈퇴 = 동의 전체철회 + 계정 비활성화.
 * (1) 본인의 모든 활성(revoked_at IS NULL) consents 를 revoked_at=now() 로 UPDATE
 * (2) users.deactivated_at=now() 로 계정 비활성화
 * 세션 종료(signOut)는 성공 후 클라이언트가 수행하므로 여기서는 하지 않는다.
 */
export async function withdrawAllConsentsAndDeactivate(): Promise<ActionResult> {
  const supabase = await createClient();
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
 * PIPA 열람권 — 본인 데이터 내보내기(JSON). 프로필 + 동의 전체 이력 + 관리 당사자 요약.
 * ⚠️ 임상 기록(records) 원문은 포함하지 않는다(이 기능의 스코프 아님 — 필요 시 별도 기능).
 * guardian 은 자신이 primary_guardian_id 인 persons 전부, person 은 자기 자신 프로필 하나.
 */
export async function exportMyData(): Promise<DataExport | { error: string }> {
  const supabase = await createClient();
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

  await logAccess(user.id, "export");

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
