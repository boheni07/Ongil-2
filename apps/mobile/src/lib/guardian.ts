import { personRegisterSchema, type PersonRegisterInput, type Role } from "@ongil/validation";
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
  const empty: PersonSummaryCards = { personId, recentRecords: [], permissionCount: 0 };
  if (!UUID_RE.test(personId)) return empty;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const [recordsRes, permsRes] = await Promise.all([
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
  };
}
