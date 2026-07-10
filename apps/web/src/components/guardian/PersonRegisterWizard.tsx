"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { PersonRegisterInput } from "@ongil/validation";
import { registerPerson } from "@/app/(app)/dashboard/actions";
import { WizardProgress } from "@/components/form/WizardProgress";
import { Button } from "@/components/ui/button";

/** persons.emergencyContactSchema에 대응하는 로컬 타입(스키마는 값만 export). */
type EmergencyContactInput = { name: string; relation?: string; phone: string };

/**
 * Flow-G-01 당사자 등록 6단계 위저드.
 * 기본정보 → 민감동의 → 장애정보 → 응급정보 → 사진 → 확인. 최종 확인에서만 registerPerson 호출.
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
const STEP_LABELS = ["기본 정보", "민감정보 동의", "장애 정보", "응급 정보", "프로필 사진", "확인"];

const fieldClass =
  "min-h-11 w-full rounded-(--br-md) border border-border bg-white px-3.5 text-body text-foreground outline-none focus-visible:border-primary-600";

export function PersonRegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"" | "M" | "F" | "other">("");
  const [consent, setConsent] = useState(false);
  const [disabilityTypes, setDisabilityTypes] = useState<string[]>([]);
  const [degree, setDegree] = useState<"" | "severe" | "mild">("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [contacts, setContacts] = useState<EmergencyContactInput[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleType(t: string) {
    setDisabilityTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function buildInput(): PersonRegisterInput {
    const hasEmergency = allergies.length || medications.length || contacts.length;
    return {
      fullName,
      birthDate,
      ...(gender ? { gender } : {}),
      sensitiveConsent: true,
      disabilityTypes,
      ...(degree ? { disabilityDegree: degree } : {}),
      ...(hasEmergency ? { emergencyInfo: { allergies, medications, contacts } } : {}),
    };
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await registerPerson(buildInput());
    if (res.error && !res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const canNext =
    (step === 1 && fullName.trim() && birthDate) ||
    (step === 2 && consent) ||
    step === 3 ||
    step === 4 ||
    step === 5;

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-1 flex-col">
      <h1 className="text-headline-1 font-extrabold text-foreground">당사자 등록</h1>
      <p className="mt-1 text-body text-muted-foreground">돌보는 당사자의 정보를 단계별로 입력해주세요.</p>

      <WizardProgress current={step} total={6} label={STEP_LABELS[step - 1]} className="mt-5 mb-6" />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Field label="이름" required>
            <input className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="당사자 이름" />
          </Field>
          <Field label="생년월일" required>
            <input type="date" className={fieldClass} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="성별 (선택)">
            <div className="grid grid-cols-3 gap-2">
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
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
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
              className="mt-1 size-5 accent-primary-600"
            />
            <span className="text-body font-semibold text-foreground">
              위 민감정보 수집·이용에 동의합니다. (필수)
            </span>
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <Field label="장애 유형 (복수 선택)">
            <div className="flex flex-wrap gap-2">
              {DISABILITY_TYPES.map((t) => (
                <Chip key={t} on={disabilityTypes.includes(t)} onClick={() => toggleType(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="장애 정도 (선택)">
            <div className="grid grid-cols-2 gap-2">
              <Chip on={degree === "severe"} onClick={() => setDegree(degree === "severe" ? "" : "severe")}>
                심한 장애
              </Chip>
              <Chip on={degree === "mild"} onClick={() => setDegree(degree === "mild" ? "" : "mild")}>
                심하지 않은 장애
              </Chip>
            </div>
          </Field>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-6">
          <TagListField label="알레르기" placeholder="예) 땅콩" values={allergies} onChange={setAllergies} />
          <TagListField label="금기·복용약물" placeholder="예) 발프로산" values={medications} onChange={setMedications} />
          <ContactsField contacts={contacts} onChange={setContacts} />
        </div>
      )}

      {step === 5 && (
        <div className="rounded-xl bg-white p-6 text-center ring-1 ring-foreground/10">
          <p className="text-5xl" aria-hidden="true">
            📷
          </p>
          <p className="mt-3 text-body font-semibold text-foreground">프로필 사진</p>
          <p className="mt-1 text-caption text-muted-foreground">
            사진 업로드는 준비 중입니다. 지금은 건너뛰고 나중에 추가할 수 있습니다.
          </p>
        </div>
      )}

      {step === 6 && (
        <div className="rounded-xl bg-white p-5 ring-1 ring-foreground/10">
          <h2 className="text-headline-3 font-bold text-accent-stone">입력 내용 확인</h2>
          <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-body">
            <Review k="이름" v={fullName || "-"} />
            <Review k="생년월일" v={birthDate || "-"} />
            <Review k="성별" v={gender === "M" ? "남성" : gender === "F" ? "여성" : gender ? "선택 안 함" : "-"} />
            <Review k="민감정보 동의" v={consent ? "동의함" : "미동의"} />
            <Review k="장애 유형" v={disabilityTypes.join(", ") || "-"} />
            <Review k="장애 정도" v={degree === "severe" ? "심한 장애" : degree === "mild" ? "심하지 않은 장애" : "-"} />
            <Review k="알레르기" v={allergies.join(", ") || "없음"} />
            <Review k="복용약물" v={medications.join(", ") || "없음"} />
            <Review k="비상연락" v={contacts.map((c) => `${c.name} ${c.phone}`).join(", ") || "없음"} />
          </dl>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-body font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-8">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => (step === 1 ? router.push("/dashboard") : setStep((s) => s - 1))}
        >
          ← {step === 1 ? "취소" : "이전"}
        </Button>
        <div className="flex-1" />
        {step < 6 ? (
          <Button type="button" className="h-11" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            다음 →
          </Button>
        ) : (
          <Button type="button" className="h-11 font-bold" disabled={busy} onClick={submit}>
            {busy ? "등록 중..." : "당사자 등록"}
          </Button>
        )}
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

function Review({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </>
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
          <input className={fieldClass} placeholder="전화번호" value={c.phone} onChange={(e) => update(i, { phone: e.target.value })} />
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
