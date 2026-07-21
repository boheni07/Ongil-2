"use server";

import { evalReportSchema, type EvalReportInput } from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";
import { notifyRecipients } from "@/lib/notify";

/**
 * P2-3 치료사(therapist) 평가보고서 스위트 Server Action 모음(TH-17, `/records/eval/new`).
 * MED-007 작성 + 동일 therapy_plan_id 3열 비교 뷰(초기|중간|최종) 데이터 제공.
 * docs/01-prd.md §5-8, docs/04-workflow.md Flow-TH-02, docs/05-erd.md §3(MED-007)·§4-2·§4-6.
 *
 * 접근 통제는 전부 기존 RLS(§4-2)에 위임한다 — records 쓰기는 permissions(도메인 write/edit)
 * 분기가 access_level만 보고 강제하며 role 무관이라 therapist도 동일하게 커버된다.
 * therapy_plan_id 자동연결은 회기일지(getSessionComposeContext)와 동일 패턴이다.
 * §4-6 확인 대상 표에 MED-007이 없어 requires_confirmation=false(일상 기록).
 * 델타(Δ)는 저장하지 않고 getEvalComparison 조회 시 계산한다(§3 MED-007 주석).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

export type EvalType = "initial" | "interim" | "final";

/** TH-17 작성 진입 컨텍스트("치료계획 자동연결" + 이미 제출된 단계 파악). */
export interface EvalComposeContext {
  /** 자동 연결된 최근 확정 MED-005 record id. 없으면 null(TH-13으로 유도). */
  therapyPlanId: string | null;
  /** 이 계획서에 이미 제출된 MED-007의 eval_type 목록(폼에서 중복 단계 선택 방지 근거). */
  existingEvalTypes: EvalType[];
}

/** TH-17 3열 비교 뷰의 한 열(eval_type 하나). */
export interface EvalColumn {
  recordId: string;
  evalDate: string;
  domainScores: { domain: string; score: number }[];
  summary: string;
  recommendations: string | null;
}

/** TH-17 3열 비교 뷰 전체 + 영역별 델타(조회 시 계산, DB 미저장). */
export interface EvalComparison {
  therapyPlanId: string;
  columns: { initial: EvalColumn | null; interim: EvalColumn | null; final: EvalColumn | null };
  deltas: {
    domain: string;
    interimVsInitial: number | null;
    finalVsInterim: number | null;
    finalVsInitial: number | null;
  }[];
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

interface RawEvalRow {
  id: string;
  content: unknown;
  record_date: string;
}

/** content에서 MED-007 필드를 안전하게 파싱한다(EvalColumn 형태). */
function toEvalColumn(id: string, content: unknown): EvalColumn {
  const c = (content ?? {}) as {
    eval_date?: unknown;
    domain_scores?: unknown;
    summary?: unknown;
    recommendations?: unknown;
  };
  const rawScores = Array.isArray(c.domain_scores) ? c.domain_scores : [];
  const domainScores = rawScores
    .map((s) => s as { domain?: unknown; score?: unknown })
    .filter((s) => typeof s.domain === "string" && typeof s.score === "number")
    .map((s) => ({ domain: s.domain as string, score: s.score as number }));
  return {
    recordId: id,
    evalDate: typeof c.eval_date === "string" ? c.eval_date : "",
    domainScores,
    summary: typeof c.summary === "string" ? c.summary : "",
    recommendations: typeof c.recommendations === "string" ? c.recommendations : null,
  };
}

/** content.eval_type을 안전하게 추출한다(유효 enum일 때만). */
function evalTypeOf(content: unknown): EvalType | null {
  const t = (content as { eval_type?: unknown } | null)?.eval_type;
  return t === "initial" || t === "interim" || t === "final" ? t : null;
}

/**
 * TH-17 작성 진입 컨텍스트 — 가장 최근 확정(is_draft=false) MED-005 하나를 자동 연결하고,
 * 그 therapy_plan_id를 가진 기존 MED-007들의 eval_type 목록을 반환한다(이미 제출된 단계 파악).
 * 회기일지 getSessionComposeContext와 동일한 자동연결 패턴.
 */
export async function getEvalComposeContext(personId: string): Promise<EvalComposeContext> {
  const empty: EvalComposeContext = { therapyPlanId: null, existingEvalTypes: [] };
  if (!UUID_RE.test(personId)) return empty;

  const supabase = await createClient();

  const { data: planRow } = await supabase
    .from("records")
    .select("id")
    .eq("person_id", personId)
    .eq("record_type", "MED-005")
    .eq("is_draft", false)
    .order("record_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!planRow) return empty;
  const therapyPlanId = planRow.id as string;

  // 이 계획서에 연결된 기존 평가보고서(MED-007)의 eval_type 파악.
  const { data: evals } = await supabase
    .from("records")
    .select("content")
    .eq("person_id", personId)
    .eq("record_type", "MED-007")
    .limit(100);

  const linked = ((evals ?? []) as { content: unknown }[]).filter((e) => {
    const c = e.content as { therapy_plan_id?: unknown } | null;
    return c?.therapy_plan_id === therapyPlanId;
  });

  const existingEvalTypes = [...new Set(linked.map((e) => evalTypeOf(e.content)).filter(Boolean))] as EvalType[];

  return { therapyPlanId, existingEvalTypes };
}

/**
 * TH-17 평가보고서 작성 — records INSERT(domain='MED', record_type='MED-007').
 * requires_confirmation=false(§4-6 표에 미포함), record_date=eval_date.
 * 저장 성공 후 best-effort로 알림 2계열 발송(실패해도 저장은 유지 — 인계인수 패턴):
 *  (a) person.primary_guardian_id, (b) 이 person에 WEL write/edit 활성 권한을 가진 social_worker 전원.
 */
export async function createEvalReport(
  personId: string,
  input: EvalReportInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "당사자 정보가 올바르지 않습니다." };

  const parsed = evalReportSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: personId,
      author_id: user.id,
      domain: "MED",
      record_type: "MED-007",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: false,
      record_date: parsed.data.eval_date,
    })
    .select("id")
    .single();

  if (insErr) return { error: `평가보고서 저장에 실패했습니다: ${insErr.message}` };
  const recordId = row.id as string;

  await logAccess(personId, "create", { recordId, domain: "MED" });

  // 보호자·담당 사회복지사 알림 — best-effort. 실패해도 저장은 유지한다(Flow-TH-02).
  const recipientIds = new Set<string>();

  const { data: person } = await supabase
    .from("persons")
    .select("primary_guardian_id")
    .eq("id", personId)
    .maybeSingle();
  const guardianId = person?.primary_guardian_id as string | null | undefined;
  if (guardianId) recipientIds.add(guardianId);

  // 이 person에 WEL write/edit 활성 권한을 가진 사회복지사 전원.
  const { data: perms } = await supabase
    .from("permissions")
    .select("grantee_id, grantee:users!grantee_id(role)")
    .eq("person_id", personId)
    .eq("domain", "WEL")
    .eq("is_active", true)
    .in("access_level", ["write", "edit"]);
  for (const p of perms ?? []) {
    const rel = p.grantee as { role?: string } | { role?: string }[] | null;
    const role = Array.isArray(rel) ? rel[0]?.role : rel?.role;
    if (role === "social_worker") recipientIds.add(p.grantee_id as string);
  }
  recipientIds.delete(user.id);

  await notifyRecipients(recipientIds, {
    type: "record_new",
    title: "새 평가보고서",
    body: "평가보고서가 등록되었습니다.",
    data: { record_id: recordId, person_id: personId, record_type: "MED-007" },
  });

  return { ok: true, recordId };
}

/**
 * TH-17 3열 비교 뷰 — 같은 person_id·therapy_plan_id를 가진 MED-007 전부를 eval_type별로
 * 그룹화한다(각 타입 최대 1건 가정, 중복 시 record_date 최신 것 채택). person_id로 먼저 좁혀
 * 조회량을 줄인다(therapy_plan_id 하나로만 필터하면 접근 가능한 전체 당사자의 MED-007을
 * 끌어와야 해 규모가 커지면 비효율적). 영역별 델타는 여기서 계산해 반환한다(DB 미저장 —
 * §3 MED-007 주석). 두 열이 모두 있을 때만 델타 값, 하나라도 없으면 null.
 */
export async function getEvalComparison(
  therapyPlanId: string,
  personId: string
): Promise<EvalComparison> {
  const empty: EvalComparison = {
    therapyPlanId,
    columns: { initial: null, interim: null, final: null },
    deltas: [],
  };
  if (!UUID_RE.test(therapyPlanId) || !UUID_RE.test(personId)) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("records")
    .select("id, content, record_date")
    .eq("record_type", "MED-007")
    .eq("person_id", personId)
    .order("record_date", { ascending: false });

  if (error || !data) return empty;

  const rows = (data as RawEvalRow[]).filter((r) => {
    const c = r.content as { therapy_plan_id?: unknown } | null;
    return c?.therapy_plan_id === therapyPlanId;
  });

  // record_date 내림차순이라 각 타입의 첫 등장이 최신 — 최초 등장만 채택.
  const byType: Record<EvalType, EvalColumn | null> = { initial: null, interim: null, final: null };
  for (const r of rows) {
    const t = evalTypeOf(r.content);
    if (t && !byType[t]) byType[t] = toEvalColumn(r.id, r.content);
  }

  const deltas = computeDeltas(byType);
  return { therapyPlanId, columns: byType, deltas };
}

/** 영역별 델타 계산 — 두 열이 모두 존재하고 해당 domain 점수가 양쪽에 있을 때만 값, 아니면 null. */
function computeDeltas(cols: Record<EvalType, EvalColumn | null>): EvalComparison["deltas"] {
  const domains = new Set<string>();
  for (const col of [cols.initial, cols.interim, cols.final]) {
    for (const s of col?.domainScores ?? []) domains.add(s.domain);
  }

  const scoreOf = (col: EvalColumn | null, domain: string): number | null => {
    const hit = col?.domainScores.find((s) => s.domain === domain);
    return hit ? hit.score : null;
  };
  const diff = (a: number | null, b: number | null): number | null =>
    a === null || b === null ? null : a - b;

  return [...domains].map((domain) => {
    const i = scoreOf(cols.initial, domain);
    const m = scoreOf(cols.interim, domain);
    const f = scoreOf(cols.final, domain);
    return {
      domain,
      interimVsInitial: diff(m, i),
      finalVsInterim: diff(f, m),
      finalVsInitial: diff(f, i),
    };
  });
}
