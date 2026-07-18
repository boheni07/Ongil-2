"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SelfExpressionInput } from "@ongil/validation";
import { submitSelfExpression } from "@/app/(app)/home/actions";
import { IconOption } from "./IconOption";
import { SaveOverlay } from "./SaveOverlay";
import { WizardProgress } from "@/components/form/WizardProgress";

/**
 * P-02 자기표현 4단계 위저드 — 기분 → 밥 → 활동(복수) → 몸 상태.
 * 중간 단계는 클라이언트 상태(useState)만 사용하고 마지막에만 submitSelfExpression 호출한다.
 */

type Mood = SelfExpressionInput["mood"];
type Meal = SelfExpressionInput["meal"];
type Activity = SelfExpressionInput["activities"][number];
type Health = SelfExpressionInput["health"];

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: "good", emoji: "😊", label: "좋아요" },
  { value: "neutral", emoji: "😐", label: "보통이에요" },
  { value: "sad", emoji: "😢", label: "슬퍼요" },
  { value: "angry", emoji: "😡", label: "화났어요" },
];
const MEALS: { value: Meal; emoji: string; label: string }[] = [
  { value: "full", emoji: "🍚", label: "잘 먹었어요" },
  { value: "partial", emoji: "😐", label: "조금 먹었어요" },
  { value: "none", emoji: "❌", label: "못 먹었어요" },
];
const ACTIVITIES: { value: Activity; emoji: string; label: string }[] = [
  { value: "exercise", emoji: "🏃", label: "운동" },
  { value: "study", emoji: "📚", label: "공부" },
  { value: "craft", emoji: "🎨", label: "만들기" },
  { value: "social", emoji: "👫", label: "친구 만남" },
];
const HEALTHS: { value: Health; emoji: string; label: string }[] = [
  { value: "good", emoji: "💪", label: "건강해요" },
  { value: "sick", emoji: "🤧", label: "감기 기운" },
  { value: "tired", emoji: "😴", label: "피곤해요" },
];

const STEP_LABELS = ["기분", "밥", "활동", "몸 상태"];

export function ExpressWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState<Mood | null>(null);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canNext =
    (step === 1 && mood) ||
    (step === 2 && meal) ||
    (step === 3 && activities.length > 0) ||
    (step === 4 && health);

  function toggleActivity(value: Activity) {
    setActivities((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit() {
    if (!mood || !meal || !health) return;
    setSaving(true);
    setError(null);
    const input: SelfExpressionInput = {
      mood,
      meal,
      activities,
      health,
      ...(memo.trim() ? { memo: memo.trim() } : {}),
    };
    const res = await submitSelfExpression(input);
    if (res.error) {
      setSaving(false);
      setError(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => {
      router.push("/home");
      router.refresh();
    }, 2000);
  }

  return (
    <div className="flex flex-1 flex-col">
      <WizardProgress current={step} total={4} label={STEP_LABELS[step - 1]} size="person" className="mb-8" />

      {step === 1 && (
        <Question title="지금 기분이 어때요?">
          <div className="grid grid-cols-2 gap-4">
            {MOODS.map((o) => (
              <IconOption key={o.value} emoji={o.emoji} label={o.label} selected={mood === o.value} onSelect={() => setMood(o.value)} />
            ))}
          </div>
        </Question>
      )}

      {step === 2 && (
        <Question title="밥 먹었어요?">
          <div className="grid grid-cols-2 gap-4">
            {MEALS.map((o) => (
              <IconOption key={o.value} emoji={o.emoji} label={o.label} selected={meal === o.value} onSelect={() => setMeal(o.value)} />
            ))}
          </div>
        </Question>
      )}

      {step === 3 && (
        <Question title="오늘 뭘 했어요?" hint="여러 개 골라도 돼요">
          <div className="grid grid-cols-2 gap-4">
            {ACTIVITIES.map((o) => (
              <IconOption key={o.value} emoji={o.emoji} label={o.label} selected={activities.includes(o.value)} onSelect={() => toggleActivity(o.value)} />
            ))}
          </div>
        </Question>
      )}

      {step === 4 && (
        <Question title="몸은 어때요?">
          <div className="grid grid-cols-2 gap-4">
            {HEALTHS.map((o) => (
              <IconOption key={o.value} emoji={o.emoji} label={o.label} selected={health === o.value} onSelect={() => setHealth(o.value)} />
            ))}
          </div>
          <label className="mt-6 block">
            <span className="mb-2 block text-person-base font-semibold text-accent-stone">
              <span aria-hidden="true">📝</span> 하고 싶은 말 (자유롭게 적어도 돼요)
            </span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="오늘 있었던 일을 자유롭게 적어요"
              className="w-full rounded-(--br-md) border-2 border-border bg-white p-4 text-person-base outline-none focus-visible:border-primary-600"
            />
          </label>
        </Question>
      )}

      {error && (
        <p role="alert" className="mt-4 text-person-base font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-auto flex gap-3 pt-8">
        <button
          type="button"
          onClick={() => (step === 1 ? router.push("/home") : setStep((s) => s - 1))}
          className="min-h-[56px] flex-1 rounded-(--br-md) border-2 border-border bg-white text-person-base font-bold text-accent-stone hover:border-primary-400"
        >
          {step === 1 ? "그만두기" : "이전"}
        </button>
        {step < 4 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
            className="min-h-[56px] flex-[2] rounded-(--br-md) bg-primary-600 text-person-base font-bold text-white disabled:opacity-40"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            disabled={!canNext || saving}
            onClick={handleSubmit}
            className="min-h-[56px] flex-[2] rounded-(--br-md) bg-accent-amber text-person-base font-bold text-accent-stone disabled:opacity-40"
          >
            {saving ? "저장 중..." : "✨ 저장하기"}
          </button>
        )}
      </div>

      <SaveOverlay show={saved} />
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-extrabold text-foreground">{title}</h2>
      {hint && <p className="mb-5 text-person-base text-accent-pebble">{hint}</p>}
      {!hint && <div className="mb-5" />}
      {children}
    </div>
  );
}
