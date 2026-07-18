"use server";

import {
  personProfileSchema,
  selfExpressionSchema,
  type PersonProfileInput,
  type SelfExpressionInput,
} from "@ongil/validation";
import type { Role } from "@ongil/validation";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";

/**
 * P1-3 당사자 자기표현 (P-01 오늘 기록 홈, P-02 자기표현 4단계) Server Action 모음.
 *
 * 자가등록 갭 해법(docs/05-erd.md §4-1/§4-2 참고): person 역할로 셀프 가입한 사용자는
 * A-04 단계에서 birth_date를 받지 않아 auth 트리거가 persons 행을 만들 수 없다. 그래서
 * P-01 최초 진입 시 persons 행이 없으면 ensurePersonProfile로 최소 정보를 받아
 * `persons.id = auth.uid()`, `primary_guardian_id = auth.uid()`(셀프 가입 성인이라 주보호자가
 * 자기 자신) 행을 생성한다. 이후 자기표현 기록은 person_id = 자기 auth.uid()로 INSERT한다.
 *
 * 전제 RLS(security-rls 담당): persons_insert에 person 역할 자기 자신 INSERT 분기,
 * records_insert에 person 역할이 자기 person_id에 한해 INSERT 가능한 분기가 필요하다.
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, error: "로그인이 필요합니다." as string };
  }
  const role = (user.user_metadata?.role as Role | undefined) ?? null;
  if (role !== "person") {
    return { supabase, user: null, error: "당사자 계정만 사용할 수 있습니다." as string };
  }
  return { supabase, user, error: null as string | null };
}

/**
 * P-01 진입 시 자기 persons 행 존재 여부. 없으면 화면에서 "내 프로필 만들기"를 띄운다.
 * 서버 컴포넌트에서 직접 호출하는 읽기 헬퍼.
 */
export async function hasPersonProfile(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("persons").select("id").eq("id", user.id).maybeSingle();
  return Boolean(data);
}

/**
 * P-01 헤더 StageBadge용 — 자기 persons 행의 birth_date(YYYY-MM-DD). 없으면 null.
 * 서버 컴포넌트에서 직접 호출하는 읽기 헬퍼.
 */
export async function getPersonBirthDate(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("persons")
    .select("birth_date")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.birth_date as string | undefined) ?? null;
}

/**
 * "내 프로필 만들기" — persons 행이 없을 때만 생성한다(멱등). 이미 있으면 성공으로 간주.
 * primary_guardian_id는 자기 자신(auth.uid())으로 두어 "보호자 없는 셀프 가입 성인"을 표현한다.
 */
export async function ensurePersonProfile(input: PersonProfileInput): Promise<ActionResult> {
  const parsed = personProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { supabase, user, error } = await requirePersonUser();
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
 * requires_confirmation은 false(§4-6 자기표현은 확인 절차 없음). person_id는 항상 자기 auth.uid().
 */
export async function submitSelfExpression(input: SelfExpressionInput): Promise<ActionResult> {
  const parsed = selfExpressionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  const { supabase, user, error } = await requirePersonUser();
  if (!user) return { error: error ?? "로그인이 필요합니다." };

  // persons 행이 없으면 기록을 남길 수 없다 — 먼저 프로필을 만들도록 안내.
  const { data: person } = await supabase
    .from("persons")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!person) {
    return { error: "먼저 내 프로필을 만들어주세요." };
  }

  const { data: row, error: insErr } = await supabase
    .from("records")
    .insert({
      person_id: user.id,
      author_id: user.id,
      domain: "DAI",
      record_type: "SELF-001",
      content: parsed.data,
      is_draft: false,
      requires_confirmation: false,
    })
    .select("id")
    .single();
  if (insErr) {
    return { error: `기록 저장에 실패했습니다: ${insErr.message}` };
  }
  await logAccess(user.id, "create", { recordId: row.id as string, domain: "DAI" });
  return { ok: true };
}

/**
 * P-01 최근 7일 자기표현 조회 — 이모지 달력용(record_date + content.mood만 사용).
 * 서버 컴포넌트에서 직접 호출한다. 미로그인/권한 없음이면 빈 배열.
 */
export async function getRecentSelfExpressions(): Promise<SelfExpressionDay[]> {
  const supabase = await createClient();
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
