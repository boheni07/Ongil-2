"use server";

import { itpSchema, type ItpInput } from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";
import { computeLifeStage, isItpActiveStage } from "@/lib/lifecycle";
import type { LifeStage } from "@/components/lifecycle/StageBadge";

/**
 * 개별화전환계획(ITP, EDU-005) 특수교사(teacher) Server Action 모음 —
 * docs/08-record-taxonomy-workshop.md 안건2-2(2026-07-17 신설).
 * `/records/itp/new` 작성 위저드·목록·조회를 지원한다.
 * docs/05-erd.md §3(EDU-005)·§4-2·§4-6①, docs/01-prd.md §3-2-1(역할×기록유형 매트릭스).
 *
 * BIP 스위트(records/bip/actions.ts)와 동일 구조를 EDU-005에 이식했다. "담당 학생"은 이 교사가
 * EDU 도메인에 활성 write/edit 권한을 가진 persons로 좁힌다(BIP/전환계획 스코핑과 동일 결정).
 * 접근 통제는 전부 기존 RLS(§4-2)에 위임한다 — DB 최종 방어선은 records_insert RLS
 * (permissions EDU write/edit 분기, record_type 무관).
 *
 * ITP는 IEP·BIP와 동급의 공식 지원계획 문서라 requires_confirmation=true(§4-6①) —
 * 제출(is_draft=false) 시 trg_assign_confirmer가 확인 주체(성년=본인, 미성년=주보호자)를
 * 자동 지정한다. 활성 단계는 청소년 전환기(만 13~18세)만 — TRA-001의 isPreTransitionStage
 * 가드와 동형으로 createItp에서 isItpActiveStage 서버 재검증을 둔다(LEG 라운드에서 겪은
 * "연령 가드 누락" 실수 재발 방지, docs/08 §6 Wave2 주의사항).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

/** 작성 대상 학생 카드(EDU write/edit 권한 보유자). */
export interface ItpClient {
  personId: string;
  fullName: string;
  birthDate: string;
  avatarUrl: string | null;
  lifeStage: LifeStage;
  /** 가장 최근 제출된 ITP(EDU-005) 요약. 없으면 null("새 ITP 작성"으로 유도). */
  latestItp: {
    id: string;
    nextReviewDate: string | null;
    requiresConfirmation: boolean;
    confirmedAt: string | null;
  } | null;
}

/** 목록 항목. */
export interface ItpRecordSummary {
  recordId: string;
  personId: string;
  careerInterestAreas: string[];
  nextReviewDate: string | null;
  recordDate: string;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
}

/** getItpDetail 상세 반환. */
export interface ItpDetail {
  recordId: string;
  personId: string;
  content: ItpInput;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmerId: string | null;
  confirmedAt: string | null;
  recordDate: string;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

function itpCareerAreas(content: unknown): string[] {
  const c = content as { career_interest_areas?: unknown } | null;
  return Array.isArray(c?.career_interest_areas)
    ? c.career_interest_areas.filter((v): v is string => typeof v === "string")
    : [];
}

function itpNextReviewDate(content: unknown): string | null {
  const c = content as { next_review_date?: unknown } | null;
  return typeof c?.next_review_date === "string" ? c.next_review_date : null;
}

interface RawItpRow {
  id: string;
  person_id: string;
  content: unknown;
  is_draft: boolean | null;
  requires_confirmation: boolean | null;
  confirmed_at: string | null;
  record_date: string;
}

/**
 * 작성 대상 학생 목록 — 이 교사가 EDU 도메인에 활성 write/edit 권한을 가진 persons.
 * 각 학생의 최근 제출 ITP(EDU-005)에서 다음 검토일·확인 상태를 파생한다.
 * life_stage는 클라이언트 헬퍼(computeLifeStage)로 통일한다(BIP/IEP/TRA 라운드와 동일 결정).
 * 목록 자체는 age-block하지 않는다(TRA-001과 동일 관행 — 선택 후 폼 진입 시 안내로 대체).
 */
export async function getItpClients(): Promise<ItpClient[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [permsRes, guardianRes] = await Promise.all([
    supabase
      .from("permissions")
      .select("person_id")
      .eq("grantee_id", user.id)
      .eq("is_active", true)
      .eq("domain", "EDU")
      .in("access_level", ["write", "edit"]),
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

  const [personsRes, itpRes] = await Promise.all([
    supabase.from("persons").select("id, full_name, birth_date, avatar_url").in("id", personIds),
    supabase
      .from("records")
      .select("id, person_id, content, requires_confirmation, confirmed_at, record_date")
      .in("person_id", personIds)
      .eq("record_type", "EDU-005")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
  ]);

  const persons = personsRes.data ?? [];
  const itps = (itpRes.data ?? []) as RawItpRow[];

  // person_id별 가장 최근 EDU-005 하나만 남긴다(정렬이 내림차순이라 첫 등장이 최신).
  const latestByPerson = new Map<string, RawItpRow>();
  for (const row of itps) {
    if (!latestByPerson.has(row.person_id)) latestByPerson.set(row.person_id, row);
  }

  return persons.map((p) => {
    const itp = latestByPerson.get(p.id as string) ?? null;
    return {
      personId: p.id as string,
      fullName: (p.full_name as string) ?? "",
      birthDate: p.birth_date as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      lifeStage: computeLifeStage(p.birth_date as string),
      latestItp: itp
        ? {
            id: itp.id,
            nextReviewDate: itpNextReviewDate(itp.content),
            requiresConfirmation: Boolean(itp.requires_confirmation),
            confirmedAt: itp.confirmed_at,
          }
        : null,
    };
  });
}

/**
 * ITP 작성 — records INSERT(domain='EDU', record_type='EDU-005').
 * 공식 지원계획 문서라 requires_confirmation=true(§4-6①) — 제출(is_draft=false) 시
 * trg_assign_confirmer가 확인 주체를 자동 지정한다.
 * 진입 가드 재검증 — ITP는 청소년 전환기(만 13~18세)에만 작성할 수 있다(TRA-001과 동형).
 */
export async function createItp(
  personId: string,
  input: ItpInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "학생 정보가 올바르지 않습니다." };

  const parsed = itpSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: person, error: personErr } = await supabase
    .from("persons")
    .select("birth_date")
    .eq("id", personId)
    .maybeSingle();
  if (personErr || !person) {
    return { error: "학생을 찾을 수 없거나 접근 권한이 없습니다." };
  }
  if (!isItpActiveStage(computeLifeStage(person.birth_date as string))) {
    return { error: "개별화전환계획은 청소년 전환기(만 13~18세) 학생에게만 작성할 수 있습니다." };
  }

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: "EDU",
      record_type: "EDU-005",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: true,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `개별화전환계획 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "EDU" });
  return { ok: true, recordId: row.id as string };
}

/**
 * 해당 학생의 ITP(EDU-005) 목록 요약을 최신순으로. 접근 가능한 것만 RLS가 반환한다.
 */
export async function listItpRecords(personId: string): Promise<ItpRecordSummary[]> {
  if (!UUID_RE.test(personId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select("id, person_id, content, is_draft, requires_confirmation, confirmed_at, record_date")
    .eq("person_id", personId)
    .eq("record_type", "EDU-005")
    .order("record_date", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as RawItpRow[]).map((row) => ({
    recordId: row.id,
    personId: row.person_id,
    careerInterestAreas: itpCareerAreas(row.content),
    nextReviewDate: itpNextReviewDate(row.content),
    recordDate: row.record_date,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmedAt: row.confirmed_at,
  }));
}

/** TRA-001 작성 화면(사회복지사)에서 참고용으로 보여줄 최소 요약(§ 안건2-2 소프트 링크). */
export interface ItpReferenceSummary {
  careerInterestAreas: string[];
  nextReviewDate: string | null;
  recordDate: string;
}

/**
 * 특정 당사자의 가장 최근 ITP(EDU-005) 요약을 반환한다 — TRA-001 위자드에서 "학교에서는 이렇게
 * 준비하고 있었다"를 참고하도록 person_id로만 느슨하게 연결한다(FK 없음, docs/08 안건2-2).
 * RLS(§4-2)가 그대로 적용되므로 조회하는 사용자가 이 당사자의 EDU 도메인 권한이 없으면
 * 자동으로 빈 결과가 반환된다(별도 권한 우회 로직 없음 — 이것이 올바른 동작이다).
 */
export async function getLatestItpSummary(personId: string): Promise<ItpReferenceSummary | null> {
  if (!UUID_RE.test(personId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select("content, record_date")
    .eq("person_id", personId)
    .eq("record_type", "EDU-005")
    .eq("is_draft", false)
    .order("record_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    careerInterestAreas: itpCareerAreas(data.content),
    nextReviewDate: itpNextReviewDate(data.content),
    recordDate: data.record_date as string,
  };
}

interface RawItpDetailRow extends RawItpRow {
  confirmer_id: string | null;
}

/**
 * ITP 상세 — content 전체 + 확인 상태. 접근 불가 시 null.
 * 목록/타임라인 제목은 RECORD_TYPE_LABEL["EDU-005"]="개별화전환계획(ITP)"로 표시된다.
 */
export async function getItpDetail(recordId: string): Promise<ItpDetail | null> {
  if (!UUID_RE.test(recordId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(
      "id, person_id, content, is_draft, requires_confirmation, confirmer_id, confirmed_at, record_date"
    )
    .eq("id", recordId)
    .eq("record_type", "EDU-005")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RawItpDetailRow;

  await logAccess(row.person_id, "view", { recordId: row.id, domain: "EDU" });

  return {
    recordId: row.id,
    personId: row.person_id,
    content: row.content as ItpInput,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmerId: row.confirmer_id,
    confirmedAt: row.confirmed_at,
    recordDate: row.record_date,
  };
}
