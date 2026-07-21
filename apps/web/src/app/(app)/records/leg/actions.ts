"use server";

import {
  guardianshipReportSchema,
  advocacyConsultationSchema,
  RECORD_TYPE_LABEL,
  type GuardianshipReportInput,
  type AdvocacyConsultationInput,
  type LegReportKind,
} from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";
import { computeLifeStage, isSelfConfirmingStage } from "@/lib/lifecycle";
import type { LifeStage } from "@/components/lifecycle/StageBadge";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * LEG(법률·권리) 도메인 Server Action 모음 — 사회복지사(social_worker) 전용.
 * `/records/leg` 목록·후견감독보고서(LEG-001) 작성·권익옹호 상담기록(LEG-002) 작성·상세 조회.
 * docs/05-erd.md §3(LEG-001/LEG-002)·§4-2·§4-6, docs/01-prd.md §3-2-1(역할×기록유형 매트릭스),
 * docs/07-lifecycle-record-permission-proposal.md §5 ①(LEG 전용 record_type 갭 해소).
 *
 * ISP/전환계획 스위트(records/isp·transition/actions.ts)와 동일 구조를 LEG 도메인에 이식했다.
 * "담당 당사자"는 이 사회복지사가 LEG 도메인에 활성 write/edit 권한을 가진 persons로 좁힌다
 * (§3-2-1 매트릭스: LEG-001/002 작성·수정 주체 = 사회복지사).
 *
 * 접근 통제(무엇을 읽고 쓸 수 있는가)는 전부 기존 RLS(§4-2, 도메인 단위)에 위임한다 —
 * records INSERT/UPDATE는 permissions(LEG write/edit) 분기가 access_level만 보고 강제한다.
 * 아래 목록 쿼리와 assertSocialWorker 역할 게이트는 앱 레이어 UX 방어선(작성 폼을
 * social_worker에게만 노출)을 서버에서 재확인하는 것이며, DB 최종 방어선은 RLS다.
 *
 * requires_confirmation: LEG-001=true(공식 서류 → trg_assign_confirmer가 성인기·노년기=본인,
 * 그 외=주보호자로 확인 주체 자동 지정), LEG-002=false(일상 기록, 확인 절차 없음). 앱 코드는
 * confirmer_id/confirmed_at을 직접 다루지 않는다.
 *
 * 연령 가드: docs/07 §4-4/§4-5에 따라 LEG는 성인기·노년기(만 19세 이상)부터 활성화된다.
 * TRA-001(transition/actions.ts)의 isPreTransitionStage 가드와 동형으로, createGuardianshipReport/
 * createAdvocacyConsultation 양쪽에서 isSelfConfirmingStage로 서버 재검증한다(RLS는 도메인 단위만
 * 강제하므로 이 가드가 없으면 영유아기 당사자에게도 후견감독보고서 작성이 가능했다 — 2026-07-17 갭 수정).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

/** LEG 목록/상세 표시용 record_type 리터럴. */
export type LegRecordType = "LEG-001" | "LEG-002";

/** `/records/leg` 담당 당사자 카드(LEG write/edit 권한 보유자). */
export interface LegClient {
  personId: string;
  fullName: string;
  birthDate: string;
  avatarUrl: string | null;
  lifeStage: LifeStage;
  /** 이 당사자의 LEG 기록(LEG-001+LEG-002) 총 건수. */
  legRecordCount: number;
  /** 가장 최근 후견감독보고서(LEG-001)의 next_report_due. 없으면 null. */
  latestReportDue: string | null;
}

/** listLegRecords 목록 행(LEG-001·LEG-002 공용 요약). */
export interface LegRecordSummary {
  recordId: string;
  personId: string;
  recordType: LegRecordType;
  /** RECORD_TYPE_LABEL 기반 한글 라벨(후견감독보고서 / 권익옹호 상담기록). */
  typeLabel: string;
  recordDate: string;
  isDraft: boolean;
  requiresConfirmation: boolean;
  confirmedAt: string | null;
  /** LEG-001에서만 의미 있음(2026-07-17 추가) — 최초 재산목록보고 vs 정기 후견사무보고. */
  reportKind: LegReportKind | null;
}

/** getLegRecordDetail 상세 반환 — record_type에 따라 content 구조가 다르다(판별 유니온). */
export type LegRecordDetail =
  | {
      recordId: string;
      personId: string;
      recordType: "LEG-001";
      content: GuardianshipReportInput;
      isDraft: boolean;
      requiresConfirmation: boolean;
      confirmerId: string | null;
      confirmedAt: string | null;
      recordDate: string;
    }
  | {
      recordId: string;
      personId: string;
      recordType: "LEG-002";
      content: AdvocacyConsultationInput;
      isDraft: boolean;
      requiresConfirmation: boolean;
      confirmerId: string | null;
      confirmedAt: string | null;
      recordDate: string;
    };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

/**
 * 현재 로그인 사용자가 social_worker 역할인지 서버에서 재확인한다(작성 게이트).
 * users_select RLS가 본인 행 조회를 허용하므로 자기 session으로 users.role을 읽는다
 * (proxy.ts getUserRole과 동일 경로). 역할이 아니면 false — 최종 방어선은 여전히 RLS다.
 */
async function assertSocialWorker(
  supabase: ServerSupabase,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.role === "social_worker";
}

interface RawLegRow {
  id: string;
  person_id: string;
  record_type: string;
  content: unknown;
  record_date: string;
}

/**
 * `/records/leg` 담당 당사자 목록 — 이 사회복지사가 LEG 도메인에 활성 write/edit 권한을 가진 persons.
 * 각 당사자의 LEG 기록 건수·최근 후견감독보고서 다음 기한을 파생한다.
 * life_stage는 클라이언트 헬퍼(computeLifeStage)로 통일한다(ISP/전환계획 라운드와 동일 결정).
 */
export async function getLegClients(): Promise<LegClient[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: perms } = await supabase
    .from("permissions")
    .select("person_id")
    .eq("grantee_id", user.id)
    .eq("is_active", true)
    .eq("domain", "LEG")
    .in("access_level", ["write", "edit"]);
  if (!perms || perms.length === 0) return [];

  const personIds = [...new Set(perms.map((p) => p.person_id as string))];

  const [personsRes, legRes] = await Promise.all([
    supabase.from("persons").select("id, full_name, birth_date, avatar_url").in("id", personIds),
    supabase
      .from("records")
      .select("id, person_id, record_type, content, record_date")
      .in("person_id", personIds)
      .eq("domain", "LEG")
      .eq("is_draft", false)
      .order("record_date", { ascending: false }),
  ]);

  const persons = personsRes.data ?? [];
  const legs = (legRes.data ?? []) as RawLegRow[];

  const countByPerson = new Map<string, number>();
  const latestReportByPerson = new Map<string, RawLegRow>();
  for (const row of legs) {
    countByPerson.set(row.person_id, (countByPerson.get(row.person_id) ?? 0) + 1);
    // 정렬이 내림차순이라 person_id별 첫 LEG-001 등장이 최신 보고서.
    if (row.record_type === "LEG-001" && !latestReportByPerson.has(row.person_id)) {
      latestReportByPerson.set(row.person_id, row);
    }
  }

  return persons.map((p) => {
    const report = latestReportByPerson.get(p.id as string) ?? null;
    const due =
      report && typeof (report.content as { next_report_due?: unknown })?.next_report_due === "string"
        ? ((report.content as { next_report_due: string }).next_report_due)
        : null;
    return {
      personId: p.id as string,
      fullName: (p.full_name as string) ?? "",
      birthDate: p.birth_date as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      lifeStage: computeLifeStage(p.birth_date as string),
      legRecordCount: countByPerson.get(p.id as string) ?? 0,
      latestReportDue: due,
    };
  });
}

/**
 * 해당 당사자의 LEG 기록 목록(LEG-001+LEG-002) 요약을 최신순으로 반환한다.
 * 접근 가능한 record만 RLS(§4-2)가 반환한다(권한 없는 당사자면 빈 배열).
 */
export async function listLegRecords(personId: string): Promise<LegRecordSummary[]> {
  if (!UUID_RE.test(personId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(
      "id, person_id, record_type, content, record_date, is_draft, requires_confirmation, confirmed_at"
    )
    .eq("person_id", personId)
    .eq("domain", "LEG")
    .order("record_date", { ascending: false });

  if (error || !data) return [];

  await logAccess(personId, "view", { domain: "LEG" });

  return data
    .filter((r) => r.record_type === "LEG-001" || r.record_type === "LEG-002")
    .map((r) => ({
      recordId: r.id as string,
      personId: r.person_id as string,
      recordType: r.record_type as LegRecordType,
      typeLabel: RECORD_TYPE_LABEL[r.record_type as string] ?? (r.record_type as string),
      recordDate: r.record_date as string,
      isDraft: Boolean(r.is_draft),
      requiresConfirmation: Boolean(r.requires_confirmation),
      confirmedAt: (r.confirmed_at as string | null) ?? null,
      reportKind:
        r.record_type === "LEG-001"
          ? ((r.content as { report_kind?: LegReportKind })?.report_kind ?? "periodic")
          : null,
    }));
}

/**
 * 후견감독보고서(LEG-001) 작성 — records INSERT(domain='LEG', record_type='LEG-001').
 * 공식 서류라 requires_confirmation=true(§4-6) — 제출(is_draft=false) 시 trg_assign_confirmer가
 * 확인 주체(성인기·노년기=본인, 그 외=주보호자)를 자동 지정한다(앱 코드는 confirmer_id를 다루지 않음).
 * 작성 게이트: social_worker 역할 + LEG write/edit 권한. DB 최종 방어선은 records_insert RLS.
 */
export async function createGuardianshipReport(
  personId: string,
  input: GuardianshipReportInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = guardianshipReportSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  if (!(await assertSocialWorker(supabase, user.id))) {
    return { error: "후견감독보고서는 사회복지사만 작성할 수 있습니다." };
  }

  // 진입 가드 재검증 — LEG는 성인기·노년기(만 19세 이상)부터 활성화된다(docs/07 §4-4/§4-5).
  const { data: person, error: personErr } = await supabase
    .from("persons")
    .select("birth_date")
    .eq("id", personId)
    .maybeSingle();
  if (personErr || !person) {
    return { error: "당사자를 찾을 수 없거나 접근 권한이 없습니다." };
  }
  if (!isSelfConfirmingStage(computeLifeStage(person.birth_date as string))) {
    return { error: "후견감독보고서는 성인기(만 19세) 이상 당사자에게만 작성할 수 있습니다." };
  }

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: "LEG",
      record_type: "LEG-001",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: true,
      record_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr) return { error: `후견감독보고서 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "LEG" });
  return { ok: true, recordId: row.id as string };
}

/**
 * 권익옹호 상담기록(LEG-002) 작성 — records INSERT(domain='LEG', record_type='LEG-002').
 * 일상 기록이라 requires_confirmation=false(§4-6, 관찰기록과 동급) — 확인 주체 지정 없음.
 * consultedAt을 record_date로 사용한다(EDU-002 observedAt와 동일 관행). 파싱 실패 시 서버시각.
 * 작성 게이트: social_worker 역할 + LEG write/edit 권한. DB 최종 방어선은 records_insert RLS.
 */
export async function createAdvocacyConsultation(
  personId: string,
  input: AdvocacyConsultationInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = advocacyConsultationSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  if (!(await assertSocialWorker(supabase, user.id))) {
    return { error: "권익옹호 상담기록은 사회복지사만 작성할 수 있습니다." };
  }

  // 진입 가드 재검증 — LEG는 성인기·노년기(만 19세 이상)부터 활성화된다(docs/07 §4-4/§4-5).
  const { data: person, error: personErr } = await supabase
    .from("persons")
    .select("birth_date")
    .eq("id", personId)
    .maybeSingle();
  if (personErr || !person) {
    return { error: "당사자를 찾을 수 없거나 접근 권한이 없습니다." };
  }
  if (!isSelfConfirmingStage(computeLifeStage(person.birth_date as string))) {
    return { error: "권익옹호 상담기록은 성인기(만 19세) 이상 당사자에게만 작성할 수 있습니다." };
  }

  const consultedAt = Date.parse(parsed.data.consultedAt)
    ? new Date(parsed.data.consultedAt).toISOString()
    : new Date().toISOString();

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: "LEG",
      record_type: "LEG-002",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: false,
      record_date: consultedAt,
    })
    .select("id")
    .single();

  if (insErr) return { error: `권익옹호 상담기록 저장에 실패했습니다: ${insErr.message}` };
  await logAccess(personId, "create", { recordId: row.id as string, domain: "LEG" });
  return { ok: true, recordId: row.id as string };
}

interface RawLegDetailRow {
  id: string;
  person_id: string;
  record_type: string;
  content: unknown;
  is_draft: boolean | null;
  requires_confirmation: boolean | null;
  confirmer_id: string | null;
  confirmed_at: string | null;
  record_date: string;
}

/**
 * LEG 기록 상세 조회 — record_type(LEG-001/LEG-002)에 따라 content 구조가 다른 판별 유니온 반환.
 * 접근 가능한 record만 RLS(§4-2)가 반환한다(권한 없으면 null).
 */
export async function getLegRecordDetail(recordId: string): Promise<LegRecordDetail | null> {
  if (!UUID_RE.test(recordId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select(
      "id, person_id, record_type, content, is_draft, requires_confirmation, confirmer_id, confirmed_at, record_date"
    )
    .eq("id", recordId)
    .eq("domain", "LEG")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as RawLegDetailRow;
  if (row.record_type !== "LEG-001" && row.record_type !== "LEG-002") return null;

  await logAccess(row.person_id, "view", { recordId: row.id, domain: "LEG" });

  const base = {
    recordId: row.id,
    personId: row.person_id,
    isDraft: Boolean(row.is_draft),
    requiresConfirmation: Boolean(row.requires_confirmation),
    confirmerId: row.confirmer_id,
    confirmedAt: row.confirmed_at,
    recordDate: row.record_date,
  };

  return row.record_type === "LEG-001"
    ? { ...base, recordType: "LEG-001", content: row.content as GuardianshipReportInput }
    : { ...base, recordType: "LEG-002", content: row.content as AdvocacyConsultationInput };
}
