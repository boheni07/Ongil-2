"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { PersonRegisterInput } from "@ongil/validation";
import {
  registerPerson,
  updateGuardianPerson,
  uploadPersonAvatar,
  type GuardianPerson,
} from "@/app/(app)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/form/DateField";
import { PhoneField } from "@/components/form/PhoneField";

/** persons.emergencyContactSchema에 대응하는 로컬 타입(스키마는 값만 export). */
type EmergencyContactInput = { name: string; relation?: string; phone: string };

/**
 * Flow-G-01 당사자 등록 — 기본정보·민감동의·장애정보·응급정보·사진을 한 화면에서 입력한다
 * (2026-07-19, 기존 6단계 위저드를 병합해 대체 — 회원가입 폼 통합과 동일한 방향).
 * 항목 수가 signup보다 적고 서로 독립적(순서 의존성 없음)이라 단계별 진행 검증이
 * 필요 없어, 필수 항목(이름·생년월일·민감정보 동의)만 채워지면 바로 제출 가능하다.
 */

const DISABILITY_TYPES = [
  "지체장애",
  "뇌병변장애",
  "시각장애",
  "청각장애",
  "언어장애",
  "지적장애",
  "자폐성장애",
  "정신장애",
  "신장장애",
  "기타",
];

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600";

export function PersonRegisterWizard({ existing = null }: { existing?: GuardianPerson | null }) {
  const router = useRouter();
  const isEdit = Boolean(existing);
  const existingEmergency = (existing?.emergencyInfo ?? null) as {
    allergies?: string[];
    medications?: string[];
    contacts?: EmergencyContactInput[];
  } | null;

  const [fullName, setFullName] = useState(existing?.fullName ?? "");
  const [birthDate, setBirthDate] = useState(existing?.birthDate ?? "");
  const [gender, setGender] = useState<"" | "M" | "F" | "other">(existing?.gender ?? "");
  // 정보 수정 시에는 민감정보 동의를 다시 요구하지 않는다(최초 등록 시 이미 받아 consents에
  // 영구 보관돼 있음) — isEdit이면 이 값은 UI에 노출되지 않고 canSubmit 계산에도 쓰이지 않는다.
  const [consent, setConsent] = useState(false);
  const [disabilityTypes, setDisabilityTypes] = useState<string[]>(existing?.disabilityTypes ?? []);
  const [degree, setDegree] = useState<"" | "severe" | "mild">(existing?.disabilityDegree ?? "");
  const [allergies, setAllergies] = useState<string[]>(existingEmergency?.allergies ?? []);
  const [medications, setMedications] = useState<string[]>(existingEmergency?.medications ?? []);
  const [contacts, setContacts] = useState<EmergencyContactInput[]>(existingEmergency?.contacts ?? []);

  // 프로필 사진: avatarPreview는 선택 즉시 보여줄 로컬 objectURL(업로드 완료 여부와 무관하게
  // 항상 썸네일을 즉시 표시), avatarUrl은 업로드 성공 후 받은 공개 URL(실제 제출값).
  // 수정 모드는 기존 avatarUrl을 미리보기로 바로 보여준다(로컬 objectURL이 아니라 이미
  // 공개 URL이므로 avatarPreview에 그대로 넣어도 안전 — revokeObjectURL 대상이 아님).
  const [avatarPreview, setAvatarPreview] = useState<string | null>(existing?.avatarUrl ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existing?.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 선택이 바뀌거나 컴포넌트가 사라질 때 이전 objectURL을 해제해 메모리 누수를 막는다.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function toggleType(t: string) {
    setDisabilityTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleAvatarSelect(file: File | undefined) {
    if (!file) return;
    setAvatarError(null);

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
    setAvatarUrl(null);
    setAvatarUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadPersonAvatar(formData);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

function buildInput(): Omit<PersonRegisterInput, "sensitiveConsent"> {
    const hasEmergency = allergies.length || medications.length || contacts.length;
    return {
      fullName,
      birthDate,
      ...(gender ? { gender } : {}),
      disabilityTypes,
      ...(degree ? { disabilityDegree: degree } : {}),
      ...(hasEmergency ? { emergencyInfo: { allergies, medications, contacts } } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
    };
  }

  const canSubmit = Boolean(
    fullName.trim() && birthDate && (isEdit || consent) && !avatarUploading
  );

  async function submit() {
    if (avatarUploading) {
      setError("프로필 사진 업로드가 끝날 때까지 잠시 기다려주세요.");
      return;
    }
    if (!fullName.trim() || !birthDate || (!isEdit && !consent)) {
      setError("이름·생년월일을 입력하고 민감정보 수집·이용에 동의해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const res =
      isEdit && existing
        ? await updateGuardianPerson(existing.id, buildInput())
        : await registerPerson({ ...buildInput(), sensitiveConsent: true });
    if (res.error && !res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full min-h-full max-w-6xl flex-1 flex-col">
      <h1 className="text-headline-1 font-extrabold text-foreground">
        {isEdit ? "당사자 정보 수정" : "당사자 등록"}
      </h1>
      <p className="mt-1 text-body text-muted-foreground">
        {isEdit ? `${existing?.fullName}님의 정보를 수정합니다.` : "돌보는 당사자의 정보를 입력해주세요."}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="-mt-1 mb-1 px-1 text-sm font-bold text-foreground">기본 정보</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="이름" required>
              <input
                className={fieldClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="당사자 이름"
              />
            </Field>
            <Field label="생년월일" required>
              <DateField className={fieldClass} value={birthDate} onChange={setBirthDate} />
            </Field>
          </div>
          <Field label="성별 (선택)">
            <div className="grid grid-cols-3 gap-2 sm:max-w-xs">
              {([
                { v: "M", l: "남성" },
                { v: "F", l: "여성" },
                { v: "other", l: "선택 안 함" },
              ] as const).map((o) => (
                <Chip key={o.v} on={gender === o.v} onClick={() => setGender(gender === o.v ? "" : o.v)}>
                  {o.l}
                </Chip>
              ))}
            </div>
          </Field>
        </fieldset>

        {!isEdit && (
          <fieldset className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
            <legend className="-mt-1 mb-1 px-1 text-sm font-bold text-foreground">민감정보 동의</legend>
            <div className="rounded-xl bg-domain-med-bg p-4 text-body text-domain-med-text ring-1 ring-domain-med-accent/30">
              <p className="font-bold">민감정보·고유식별정보 수집·이용 동의 (개인정보보호법 §23)</p>
              <p className="mt-2 leading-relaxed text-foreground/80">
                당사자의 장애 유형·정도, 건강·응급 정보 등 민감정보를 온길에 기록·보관하기 위해서는 보호자의
                별도 동의가 필요합니다. 이 정보는 서비스 제공과 응급 대응 목적에만 사용되며, 언제든지 열람·정정·삭제를
                요청할 수 있습니다.
              </p>
            </div>
            <label className="flex items-start gap-3 rounded-xl border-2 border-border p-4 has-checked:border-primary-600 has-checked:bg-primary-50">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-primary-600"
              />
              <span className="text-body font-semibold text-foreground">
                위 민감정보 수집·이용에 동의합니다. (필수)
              </span>
            </label>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="-mt-1 mb-1 px-1 text-sm font-bold text-foreground">장애 정보 (선택)</legend>
          <Field label="장애 유형 (복수 선택)">
            <div className="flex flex-wrap gap-2">
              {DISABILITY_TYPES.map((t) => (
                <Chip key={t} on={disabilityTypes.includes(t)} onClick={() => toggleType(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="장애 정도">
            <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
              <Chip on={degree === "severe"} onClick={() => setDegree(degree === "severe" ? "" : "severe")}>
                심한 장애
              </Chip>
              <Chip on={degree === "mild"} onClick={() => setDegree(degree === "mild" ? "" : "mild")}>
                심하지 않은 장애
              </Chip>
            </div>
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <legend className="-mt-1 mb-1 px-1 text-sm font-bold text-foreground">응급 정보 (선택)</legend>
          <div className="grid gap-6 sm:grid-cols-2">
            <TagListField label="알레르기" placeholder="예) 땅콩" values={allergies} onChange={setAllergies} />
            <TagListField label="금기·복용약물" placeholder="예) 발프로산" values={medications} onChange={setMedications} />
          </div>
          <ContactsField contacts={contacts} onChange={setContacts} />
        </fieldset>
      </div>

      {/* 오른쪽 사이드바(lg:sticky) — 프로필 사진·요약·액션 버튼을 스크롤 중에도 계속 접근
          가능하게 둔다(2026-07-20, JournalWizard와 동일한 와이드 레이아웃 원칙). */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <p className="mb-3 text-sm font-bold text-foreground">프로필 사진 (선택)</p>
          <div className="flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={avatarPreview ? "프로필 사진 변경" : "프로필 사진 선택"}
              className="relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition-colors hover:border-primary-400"
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- 로컬 objectURL 즉시 미리보기(next/image는 blob: URL 미지원)
                <img src={avatarPreview} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-3xl" aria-hidden="true">
                  📷
                </span>
              )}
              {avatarUploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-caption font-semibold text-white">
                  업로드 중...
                </span>
              )}
            </button>
            <p className="text-caption text-muted-foreground">PNG·JPEG·WebP, 5MB 이하</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                {avatarPreview ? "사진 변경" : "사진 선택"}
              </Button>
              {avatarPreview && (
                <Button type="button" variant="ghost" size="sm" onClick={removeAvatar}>
                  제거
                </Button>
              )}
            </div>
            {avatarError && (
              <p role="alert" className="text-caption font-semibold text-red-600">
                {avatarError}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => handleAvatarSelect(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-5">
          <h3 className="text-label font-bold text-primary-800">요약</h3>
          <dl className="mt-2 flex flex-col gap-1.5 text-caption">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">이름</dt>
              <dd className="font-semibold text-foreground">{fullName || "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">생년월일</dt>
              <dd className="font-semibold text-foreground">{birthDate || "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">장애 유형</dt>
              <dd className="text-right font-semibold text-foreground">
                {disabilityTypes.length > 0 ? disabilityTypes.join(", ") : "-"}
              </dd>
            </div>
          </dl>
        </div>

        {error && (
          <p role="alert" className="text-body font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
          <Button type="button" className="h-11 font-bold" disabled={busy || !canSubmit} onClick={submit}>
            {busy ? "저장 중..." : isEdit ? "저장" : "당사자 등록"}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => router.push("/dashboard")}>
            취소
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label font-semibold text-accent-stone">
        {label} {required && <span className="text-domain-med-text">*</span>}
      </span>
      {children}
    </label>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-(--br-md) border-2 px-4 text-body font-semibold transition-colors ${
        on ? "border-primary-600 bg-primary-50 text-primary-800" : "border-border text-accent-stone hover:border-primary-400"
      }`}
    >
      {children}
    </button>
  );
}

function TagListField({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-semibold text-accent-stone">{label}</span>
      <div className="flex gap-2">
        <input
          className={fieldClass}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" className="h-11 shrink-0" onClick={add}>
          추가
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <li key={`${v}-${i}`} className="flex items-center gap-1 rounded-(--br-sm) bg-muted px-2 py-1 text-caption text-accent-stone">
              {v}
              <button
                type="button"
                aria-label={`${v} 삭제`}
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-domain-med-text"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactsField({
  contacts,
  onChange,
}: {
  contacts: EmergencyContactInput[];
  onChange: (v: EmergencyContactInput[]) => void;
}) {
  function update(i: number, patch: Partial<EmergencyContactInput>) {
    onChange(contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-semibold text-accent-stone">비상 연락처</span>
      {contacts.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input className={fieldClass} placeholder="이름" value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
          <PhoneField className={fieldClass} value={c.phone} onChange={(v) => update(i, { phone: v })} />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0"
            aria-label="연락처 삭제"
            onClick={() => onChange(contacts.filter((_, j) => j !== i))}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={() => onChange([...contacts, { name: "", phone: "" }])}
      >
        + 연락처 추가
      </Button>
    </div>
  );
}
