import {
  personRegisterSchema,
  personUpdateSchema,
  selfExpressionSchema,
  type PersonRegisterInput,
  type PersonUpdateInput,
  type SelfExpressionInput,
  type Role,
} from "@ongil/validation";
import { supabase } from "./supabase";

/**
 * P1-5 보호자 대시보드(G-01) + 당사자 등록 6단계(Flow-G-01) 데이터 접근.
 * 웹 Server Action(apps/web/src/app/(app)/dashboard/actions.ts)과 동일한 순차 INSERT를
 * 재현한다: persons → guardians(필수) → consents. guardians 실패 시 persons 롤백.
 * (모바일에는 요청 헤더가 없어 consents.ip_address는 null로 저장한다.)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RegisterPersonResult {
  ok?: boolean;
  error?: string;
  personId?: string;
}

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

export interface PersonSummaryCards {
  personId: string;
  recentRecords: {
    id: string;
    domain: string;
    recordType: string;
    recordDate: string;
  }[];
  permissionCount: number;
  pendingConfirmationCount: number;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/** Flow-G-01 당사자 등록 — persons → guardians → consents 순차 INSERT. */
export async function registerPerson(input: PersonRegisterInput): Promise<RegisterPersonResult> {
  const parsed = personRegisterSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "guardian") {
    return { error: "보호자 계정만 당사자를 등록할 수 있습니다." };
  }

  const {
    fullName,
    birthDate,
    gender,
    disabilityTypes,
    disabilityDegree,
    emergencyInfo,
    avatarUrl,
  } = parsed.data;

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

  // 3) consents — 민감정보 대리 동의(§2-8).
  const { error: consentErr } = await supabase.from("consents").insert({
    user_id: user.id,
    consent_type: "sensitive",
    is_agreed: true,
    on_behalf: true,
    on_behalf_of: personId,
    version: "v1.0",
    agreed_at: new Date().toISOString(),
    ip_address: null,
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

/**
 * G-03 당사자 정보 수정 — persons UPDATE. 웹 updateGuardianPerson(dashboard/actions.ts)과
 * 동일하게 안전 컬럼(full_name·birth_date·gender·disability_*·emergency_info·avatar_url)만
 * 갱신한다. 접근 통제는 persons_update RLS(보호자 또는 셀프 당사자, 안전 컬럼 GRANT)에 위임.
 * 최초 등록 시 받은 민감정보 동의(consents)는 수정 시 다시 요구하지 않는다(웹과 동일).
 */
export async function updatePerson(
  personId: string,
  input: PersonUpdateInput
): Promise<RegisterPersonResult> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = personUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

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
  return { ok: true, personId };
}

/**
 * G-22 보호자 대리 자기표현(SELF-001) — docs/07 §5 갭⑥.
 * 당사자가 스스로 기록하기 어려운 경우 보호자가 대신 자기표현을 남긴다. 당사자 셀프 작성
 * (person.ts submitSelfExpression, author_id=person_id=당사자)과 달리 author_id=보호자,
 * person_id=당사자로 저장돼 감사에서 대리 작성임이 구분된다(웹 createSelfExpressionForPerson과 동형).
 * 접근 통제는 records_insert RLS(guardians 분기, 도메인 무관)에 위임한다. 일상 기록이라
 * requires_confirmation=false(§4-6) — 확인 절차 없음. logAccess는 best-effort(실패해도 저장 유지).
 */
export async function createSelfExpressionForPerson(
  personId: string,
  input: SelfExpressionInput
): Promise<RegisterPersonResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = selfExpressionSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id, // 보호자 본인 — 대리 작성 주체를 감사에 남긴다.
      domain: "DAI",
      record_type: "SELF-001",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: false,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `기록 저장에 실패했습니다: ${insErr.message}` };

  try {
    await supabase.from("access_logs").insert({
      actor_id: user.id,
      person_id: personId,
      record_id: row.id as string,
      action: "create",
      domain: "DAI",
      ip_address: null,
      user_agent: null,
    });
  } catch {
    // 감사 로그 실패는 사용자 작업을 막지 않는다.
  }

  return { ok: true, recordId: row.id as string };
}

/** G-01 대시보드 — 보호자가 접근 가능한 당사자 목록(응급정보 포함). */
export async function getGuardianPersons(): Promise<GuardianPerson[]> {
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

/** G-01 요약 카드 — 특정 당사자의 최근 기록 5건 + 활성 권한 개수. */
export async function getPersonSummaryCards(personId: string): Promise<PersonSummaryCards> {
  const empty: PersonSummaryCards = {
    personId,
    recentRecords: [],
    permissionCount: 0,
    pendingConfirmationCount: 0,
  };
  if (!UUID_RE.test(personId)) return empty;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const [recordsRes, permsRes, pendingRes] = await Promise.all([
    supabase
      .from("records")
      .select("id, domain, record_type, record_date")
      .eq("person_id", personId)
      .eq("is_draft", false)
      .order("record_date", { ascending: false })
      .limit(5),
    supabase
      .from("permissions")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId)
      .eq("is_active", true),
    supabase
      .from("records")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId)
      .eq("requires_confirmation", true)
      .is("confirmed_at", null),
  ]);

  const recentRecords = (recordsRes.data ?? []).map((row) => ({
    id: row.id as string,
    domain: row.domain as string,
    recordType: row.record_type as string,
    recordDate: row.record_date as string,
  }));

  return {
    personId,
    recentRecords,
    permissionCount: permsRes.count ?? 0,
    pendingConfirmationCount: pendingRes.count ?? 0,
  };
}
