"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * 프로필 수정 — 라우트 /settings/profile. 갱신 가능한 컬럼은 마이그레이션
 * 20260719030000_p3_users_self_profile_update가 연 full_name/avatar_url 두 개뿐이다
 * (users_deactivate_own 정책이 이미 "본인 행만"을 강제 — 새 RLS 정책 불필요).
 */

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

export interface UploadAvatarResult {
  ok?: boolean;
  url?: string;
  error?: string;
}

const AVATAR_BUCKET = "person-avatars";
const AVATAR_MAX_SIZE = 5242880; // 5 MiB
const AVATAR_ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

/** 프로필 사진 업로드 — person-avatars 버킷의 storage RLS는 업로더 본인 폴더({uid}/...)면
 * 누구든 허용하므로(2026-07-19 신설 당시부터 role 제한 없음), 새 버킷 없이 그대로 재사용한다. */
export async function uploadOwnAvatar(formData: FormData): Promise<UploadAvatarResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "업로드할 사진을 선택해주세요." };
  }
  if (file.size > AVATAR_MAX_SIZE) {
    return { error: "사진 크기는 5MB를 초과할 수 없습니다." };
  }
  if (!AVATAR_ALLOWED_MIME.includes(file.type)) {
    return { error: `허용되지 않는 형식입니다 (${file.type || "unknown"}). PNG/JPEG/WebP 이미지만 가능합니다.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    return { error: `업로드 실패: ${upErr.message}` };
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** 이름·프로필 사진 저장. avatarUrl이 null이면 컬럼을 건드리지 않는다(사진 미변경과
 * "사진 제거"를 구분하기 위해 제거 시엔 빈 문자열이 아니라 명시적으로 null을 전달해야 한다). */
export async function updateOwnProfile(
  input: { fullName: string; avatarUrl: string | null }
): Promise<ActionResult> {
  const fullName = input.fullName.trim();
  if (!fullName) {
    return { error: "이름을 입력해주세요." };
  }
  if (fullName.length > 100) {
    return { error: "이름은 100자 이내여야 합니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName, avatar_url: input.avatarUrl })
    .eq("id", user.id);

  if (error) {
    return { error: `저장 실패: ${error.message}` };
  }
  return { ok: true };
}
