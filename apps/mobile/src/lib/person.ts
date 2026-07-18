import {
  personProfileSchema,
  selfExpressionSchema,
  type PersonProfileInput,
  type Role,
  type SelfExpressionInput,
} from "@ongil/validation";
import { supabase } from "./supabase";

/**
 * P1-3 당사자 자기표현 (P-01 홈, P-02 4단계) 데이터 접근.
 * 웹 Server Action(apps/web/src/app/(app)/home/actions.ts)과 동일한 테이블/컬럼/값을
 * Supabase 직접 호출로 재현한다. 검증 스키마는 @ongil/validation을 그대로 공유한다.
 */

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

/** 최근 7일 자기표현 요약 — P-01 이모지 달력용 */
export interface SelfExpressionDay {
  recordDate: string;
  mood: SelfExpressionInput["mood"] | null;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인해주세요.";
}

async function requirePersonUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, error: "로그인이 필요합니다." as string };
  }
  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "person") {
    return { user: null, error: "당사자 계정만 사용할 수 있습니다." as string };
  }
  return { user, error: null as string | null };
}

/** P-01 인사말·존재 확인용 — 자기 persons 프로필(이름·생년월일). 없으면 null. */
export async function getMyPersonProfile(): Promise<{
  fullName: string;
  birthDate: string;
} | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("persons")
    .select("full_name, birth_date")
    .eq("id", user.id)
    .maybeSingle();
  return data
    ? { fullName: data.full_name as string, birthDate: data.birth_date as string }
    : null;
}

/** P-01 진입 시 자기 persons 행 존재 여부. */
export async function hasPersonProfile(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("persons").select("id").eq("id", user.id).maybeSingle();
  return Boolean(data);
}

/**
 * "내 프로필 만들기" — persons 행이 없을 때만 생성(멱등).
 * primary_guardian_id는 자기 자신(auth.uid())으로 둔다(보호자 없는 셀프 가입 성인).
 */
export async function ensurePersonProfile(input: PersonProfileInput): Promise<ActionResult> {
  const parsed = personProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { user, error } = await requirePersonUser();
  if (!user) return { error: error ?? "로그인이 필요합니다." };

  const { data: existing } = await supabase
    .from("persons")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return { ok: true };

  const { fullName, birthDate, gender } = parsed.data;
  const { error: insErr } = await supabase.from("persons").insert({
    id: user.id,
    primary_guardian_id: user.id,
    full_name: fullName,
    birth_date: birthDate,
    gender: gender ?? null,
    updated_at: new Date().toISOString(),
  });
  if (insErr) {
    return { error: `프로필 생성에 실패했습니다: ${insErr.message}` };
  }
  return { ok: true };
}

/**
 * P-02 자기표현 제출 — records INSERT(domain='DAI', record_type='SELF-001').
 * person_id = author_id = 자기 auth.uid(), requires_confirmation=false.
 */
export async function submitSelfExpression(input: SelfExpressionInput): Promise<ActionResult> {
  const parsed = selfExpressionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { user, error } = await requirePersonUser();
  if (!user) return { error: error ?? "로그인이 필요합니다." };

  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!person) {
    return { error: "먼저 내 프로필을 만들어주세요." };
  }

  const { error: insErr } = await supabase.from("records").insert({
    person_id: user.id,
    author_id: user.id,
    domain: "DAI",
    record_type: "SELF-001",
    content: parsed.data,
    is_draft: false,
    requires_confirmation: false,
  });
  if (insErr) {
    return { error: `기록 저장에 실패했습니다: ${insErr.message}` };
  }
  return { ok: true };
}

/** P-01 최근 7일 자기표현 조회 — 이모지 달력용(record_date + content.mood). */
export async function getRecentSelfExpressions(): Promise<SelfExpressionDay[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data, error } = await supabase
    .from("records")
    .select("record_date, content")
    .eq("person_id", user.id)
    .eq("record_type", "SELF-001")
    .gte("record_date", since.toISOString())
    .order("record_date", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const content = row.content as Partial<SelfExpressionInput> | null;
    return {
      recordDate: row.record_date as string,
      mood: content?.mood ?? null,
    };
  });
}
