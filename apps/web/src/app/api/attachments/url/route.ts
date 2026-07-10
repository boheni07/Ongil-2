import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authFromRequest } from "@/lib/supabase/from-request";
import { verifyReauthToken, REAUTH_COOKIE, REAUTH_HEADER } from "@/lib/reauth";

const BUCKET = "records-attachments";
const SIGNED_URL_TTL = 3600; // 1시간
const SENSITIVE_DOMAINS = new Set(["MED", "LEG"]);

/**
 * 첨부파일 presigned URL 발급 (만료 1시간).
 * ?id=<record_attachments.id>
 *
 * 방어선 순서:
 *  1) record_attachments SELECT RLS — record 읽기 권한 없으면 행 자체가 안 보임 → 403.
 *  2) 애플리케이션 레벨 도메인 판정 — MED/LEG 는 유효한 재인증 토큰(쿠키 또는 x-reauth-token
 *     헤더) 없으면 URL 미발급 + { reauthRequired: true }.
 *  3) createSignedUrl 은 storage.objects SELECT RLS 를 최종 통과해야 서명됨.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id 쿼리 파라미터가 필요합니다." }, { status: 400 });
  }

  const { supabase, user } = await authFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  // (1) 첨부 메타데이터 — RLS 로 접근 가능한 경우에만 반환됨
  const { data: attachment, error: attErr } = await supabase
    .from("record_attachments")
    .select("id, file_url, record_id")
    .eq("id", id)
    .maybeSingle();

  if (attErr || !attachment) {
    return NextResponse.json({ error: "첨부파일을 찾을 수 없거나 접근 권한이 없습니다." }, { status: 403 });
  }

  // 대상 record 의 domain 조회 (RLS 통과)
  const { data: record, error: recErr } = await supabase
    .from("records")
    .select("domain")
    .eq("id", attachment.record_id)
    .maybeSingle();

  if (recErr || !record) {
    return NextResponse.json({ error: "기록에 접근할 수 없습니다." }, { status: 403 });
  }

  // (2) 민감 도메인 재인증 게이트
  if (SENSITIVE_DOMAINS.has(record.domain as string)) {
    const cookieStore = await cookies();
    const token = cookieStore.get(REAUTH_COOKIE)?.value ?? request.headers.get(REAUTH_HEADER);
    if (!verifyReauthToken(token, user.id)) {
      return NextResponse.json(
        { error: "민감 정보(의료·법률) 열람에는 재인증이 필요합니다.", reauthRequired: true },
        { status: 403 }
      );
    }
  }

  // (3) presigned URL 발급 — storage.objects RLS 최종 방어선
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attachment.file_url, SIGNED_URL_TTL);

  if (signErr || !signed) {
    return NextResponse.json({ error: signErr?.message ?? "URL 발급에 실패했습니다." }, { status: 403 });
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL, domain: record.domain });
}
