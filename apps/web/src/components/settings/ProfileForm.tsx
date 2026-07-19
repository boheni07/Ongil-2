"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateOwnProfile, uploadOwnAvatar } from "@/app/(app)/settings/profile/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const ROLE_LABEL: Record<string, string> = {
  guardian: "보호자",
  person: "당사자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

export interface ProfileFormProps {
  email: string;
  role: string;
  fullName: string;
  avatarUrl: string | null;
}

/**
 * 프로필 수정(/settings/profile) — 이름·프로필 사진만 갱신 가능(마이그레이션
 * 20260719030000이 연 컬럼과 정확히 일치). 사진 업로드 UX는 PersonRegisterWizard의
 * "선택 즉시 로컬 미리보기 → 업로드 완료 시 공개 URL로 교체" 관행을 그대로 따른다.
 */
export function ProfileForm({ email, role, fullName: initialFullName, avatarUrl: initialAvatarUrl }: ProfileFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initialFullName);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  async function handleAvatarSelect(file: File | undefined) {
    if (!file) return;
    setAvatarError(null);
    setSaved(false);

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarError("PNG/JPEG/WebP 이미지만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("사진 크기는 5MB를 초과할 수 없습니다.");
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadOwnAvatar(formData);
    setAvatarUploading(false);
    if (res.error || !res.url) {
      setAvatarError(res.error ?? "업로드에 실패했습니다.");
      return;
    }
    setAvatarUrl(res.url);
  }

  function removeAvatar() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarUrl(null);
    setAvatarError(null);
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const canSubmit = Boolean(fullName.trim()) && !avatarUploading && !busy;
  const displayAvatar = avatarPreview ?? avatarUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (avatarUploading) {
      setError("사진 업로드가 끝난 뒤 저장해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await updateOwnProfile({ fullName, avatarUrl });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-body font-bold text-foreground">프로필 사진</legend>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={displayAvatar ? "프로필 사진 변경" : "프로필 사진 선택"}
            className="relative size-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted"
          >
            <Avatar className="size-20">
              {displayAvatar ? <AvatarImage src={displayAvatar} alt="" /> : null}
              <AvatarFallback className="text-xl">{fullName ? fullName.slice(0, 1) : "?"}</AvatarFallback>
            </Avatar>
            {avatarUploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-semibold text-white">
                업로드 중...
              </span>
            )}
          </button>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleAvatarSelect(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
            >
              {displayAvatar ? "사진 변경" : "사진 선택"}
            </Button>
            {displayAvatar && (
              <button
                type="button"
                onClick={removeAvatar}
                className="text-left text-caption font-semibold text-red-600 hover:underline"
              >
                사진 제거
              </button>
            )}
          </div>
        </div>
        {avatarError && (
          <p role="alert" className="text-caption font-semibold text-red-600">
            {avatarError}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-body font-bold text-foreground">기본 정보</legend>
        <div>
          <label htmlFor="fullName" className="mb-1 block text-caption font-semibold text-muted-foreground">
            이름
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setSaved(false);
            }}
            maxLength={100}
            className="min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600"
          />
        </div>
        <div>
          <p className="mb-1 text-caption font-semibold text-muted-foreground">이메일</p>
          <p className="min-h-11 flex items-center rounded-(--br-md) border border-border bg-muted px-3.5 text-body text-muted-foreground">
            {email}
          </p>
        </div>
        <div>
          <p className="mb-1 text-caption font-semibold text-muted-foreground">역할</p>
          <p className="min-h-11 flex items-center rounded-(--br-md) border border-border bg-muted px-3.5 text-body text-muted-foreground">
            {ROLE_LABEL[role] ?? role}
          </p>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-caption font-semibold text-red-600">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-caption font-semibold text-primary-700">저장되었습니다.</p>}

      <Button type="submit" disabled={!canSubmit} className="h-11 self-start bg-accent-amber font-bold text-accent-stone hover:bg-[#f5bd5e]">
        {busy ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
