import { evalReportSchema, type EvalReportInput, type DomainKey } from "@ongil/validation";
import { supabase } from "./supabase";

/**
 * P2-3 치료사(therapist) 평가보고서 스위트 데이터 접근(모바일, TH-17).
 * 웹 Server Action(apps/web/src/app/(app)/records/eval/actions.ts)의 로직을
 * Supabase 직접 호출로 동일하게 재현한다. DB 계약(테이블·컬럼·record_type 값·
 * requires_confirmation 규칙·알림 대상)은 웹과 1:1 대응하며 임의로 바꾸지 않는다.
 *
 * 접근 통제는 전부 기존 RLS(§4-2)에 위임한다. therapy_plan_id 자동연결은 lib/therapy.ts의
 * getSessionComposeContext와 동일 패턴. §4-6 확인 대상 표에 MED-007이 없어
 * requires_confirmation=false. 델타(Δ)는 저장하지 않고 getEvalComparison 조회 시 계산한다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * G-40 접근 로그 기록(모바일) — access_logs INSERT(§4-4). lib/therapy.ts의 logAccess와 동일하며,
 * next/headers(IP·UA)가 없어 ip_address/user_agent는 null. best-effort라 실패해도 무시한다.
 */
type AccessLogAction = "view" | "create" | "update" | "export";

async function logAccess(
  personId: string,
  action: AccessLogAction,
  opts?: { recordId?: string; domain?: DomainKey }
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("access_logs").insert({
      actor_id: user.id,
      person_id: personId,
      record_id: opts?.recordId ?? null,
      action,
      domain: opts?.domain ?? null,
      ip_address: null,
      user_agent: null,
    });
  } catch {
    // 감사 로그 실패는 사용자 작업을 막지 않는다 — 조용히 무시.
  }
}

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
 * TH-17 작성 진입 컨텍스트 — 가장 최근 확정 MED-005 하나를 자동 연결하고,
 * 그 therapy_plan_id를 가진 기존 MED-007들의 eval_type 목록을 반환한다.
 */
export async function getEvalComposeContext(personId: string): Promise<EvalComposeContext> {
  const empty: EvalComposeContext = { therapyPlanId: null, existingEvalTypes: [] };
  if (!UUID_RE.test(personId)) return empty;

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
 * requires_confirmation=false, record_date=eval_date. 저장 후 best-effort 알림 2계열:
 *  (a) person.primary_guardian_id, (b) 이 person에 WEL write/edit 활성 권한을 가진 social_worker 전원.
 */
export async function createEvalReport(
  personId: string,
  input: EvalReportInput
): Promise<ActionResult & { recordId?: string }> {
  if (!UUID_RE.test(personId)) return { error: "아동 정보가 올바르지 않습니다." };

  const parsed = evalReportSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

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
  try {
    const recipientIds = new Set<string>();

    const { data: person } = await supabase
      .from("persons")
      .select("primary_guardian_id")
      .eq("id", personId)
      .maybeSingle();
    const guardianId = person?.primary_guardian_id as string | null | undefined;
    if (guardianId) recipientIds.add(guardianId);

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

    if (recipientIds.size > 0) {
      await supabase.from("notifications").insert(
        [...recipientIds].map((rid) => ({
          recipient_id: rid,
          type: "record_new",
          title: "새 평가보고서",
          body: "평가보고서가 등록되었습니다.",
          data: { record_id: recordId, person_id: personId, record_type: "MED-007" },
        }))
      );
    }
  } catch {
    // 알림 실패는 무시(부가 기능).
  }

  return { ok: true, recordId };
}

/**
 * TH-17 3열 비교 뷰 — 같은 person_id·therapy_plan_id를 가진 MED-007 전부를 eval_type별로
 * 그룹화한다(각 타입 최대 1건 가정, 중복 시 record_date 최신 것). person_id로 먼저 좁혀
 * 조회량을 줄인다. 영역별 델타는 여기서 계산해 반환한다. 두 열이 모두 있을 때만 델타 값,
 * 하나라도 없으면 null.
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
