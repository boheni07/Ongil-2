"use server";

import { headers } from "next/headers";
import { personRegisterSchema, type PersonRegisterInput } from "@ongil/validation";
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

/** G-01 요약 카드 데이터 */
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
 * G-01 요약 카드 — 특정 당사자의 최근 기록 5건 + 활성 권한 개수.
 * RLS로 접근 가능한 데이터만 반환된다.
 */
export async function getPersonSummaryCards(personId: string): Promise<PersonSummaryCards> {
  const empty: PersonSummaryCards = {
    personId,
    recentRecords: [],
    permissionCount: 0,
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
