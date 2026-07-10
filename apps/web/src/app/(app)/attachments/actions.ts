"use server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "records-attachments";
const MAX_SIZE = 52428800; // 50 MiB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UploadState {
  ok?: boolean;
  error?: string;
  path?: string;
  attachmentId?: string;
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-100) || "file";
}

/**
 * Flow-SYS-04 파일 첨부: 클라이언트 검증(크기·형식) → Storage 업로드 →
 * 성공 시 record_attachments INSERT. 경로는 `{person_id}/{record_id}/{filename}` 로 강제.
 * 스토리지 업로드/테이블 INSERT 모두 사용자 세션(RLS) 으로 수행되므로 권한 없는 요청은 차단된다.
 */
export async function uploadAttachment(
  _prev: UploadState | undefined,
  formData: FormData
): Promise<UploadState> {
  const personId = String(formData.get("personId") ?? "").trim();
  const recordId = String(formData.get("recordId") ?? "").trim();
  const file = formData.get("file");

  if (!UUID_RE.test(personId) || !UUID_RE.test(recordId)) {
    return { error: "person_id / record_id 형식이 올바르지 않습니다." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "업로드할 파일을 선택해주세요." };
  }
  if (file.size > MAX_SIZE) {
    return { error: "파일 크기는 50MiB 를 초과할 수 없습니다." };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { error: `허용되지 않는 형식입니다 (${file.type || "unknown"}). 이미지(PNG/JPEG/WebP) 또는 PDF 만 가능합니다.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const path = `${personId}/${recordId}/${Date.now()}-${sanitize(file.name)}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    return { error: `업로드 실패(권한 또는 경로): ${upErr.message}` };
  }

  const { data: row, error: insErr } = await supabase
    .from("record_attachments")
    .insert({
      record_id: recordId,
      file_name: file.name,
      file_url: path,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (insErr) {
    // 메타데이터 INSERT 가 실패하면 방금 올린 객체를 되돌린다(고아 파일 방지).
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `첨부 메타데이터 저장 실패: ${insErr.message}` };
  }

  return { ok: true, path, attachmentId: row.id };
}
