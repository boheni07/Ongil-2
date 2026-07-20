import type { SelfExpressionInput } from "@ongil/validation";

/**
 * G-20 기록 관리 우측 상세 — 자기표현(SELF-001) 읽기 전용 뷰.
 * ExpressWizard.tsx의 이모지 AAC 라벨을 그대로 가져온다. SELF는 도메인 색상 토큰이
 * 없으므로(6도메인 밖) 중립적인 primary 톤으로 배지를 구성한다.
 */

const MOOD_LABEL: Record<SelfExpressionInput["mood"], string> = {
  good: "😊 좋아요",
  neutral: "😐 보통이에요",
  sad: "😢 슬퍼요",
  angry: "😡 화났어요",
};
const MEAL_LABEL: Record<SelfExpressionInput["meal"], string> = {
  full: "🍚 잘 먹었어요",
  partial: "😐 조금 먹었어요",
  none: "❌ 못 먹었어요",
};
const HEALTH_LABEL: Record<SelfExpressionInput["health"], string> = {
  good: "💪 건강해요",
  sick: "🤧 감기 기운",
  tired: "😴 피곤해요",
};
const ACTIVITY_LABEL: Record<SelfExpressionInput["activities"][number], string> = {
  exercise: "🏃 운동",
  study: "📚 공부",
  craft: "🎨 만들기",
  social: "👫 친구 만남",
};

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="text-xl leading-none">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold tracking-wide text-primary-700/70 uppercase">{label}</span>
        <span className="text-body font-bold text-foreground">
          {value || <span className="font-normal text-muted-foreground">—</span>}
        </span>
      </div>
    </div>
  );
}

export function SelfExpressionReadView({ content }: { content: unknown }) {
  const c = (content ?? {}) as Partial<SelfExpressionInput>;
  const activities = c.activities ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-primary-50/70 p-4 ring-1 ring-primary-100">
        <SummaryStat icon="🙂" label="기분" value={c.mood ? MOOD_LABEL[c.mood] : undefined} />
        <SummaryStat icon="🍽" label="식사" value={c.meal ? MEAL_LABEL[c.meal] : undefined} />
        <SummaryStat icon="🩺" label="몸 상태" value={c.health ? HEALTH_LABEL[c.health] : undefined} />
      </div>

      {activities.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-3 text-sm font-bold text-foreground">오늘 한 활동</h3>
          <div className="flex flex-wrap gap-2">
            {activities.map((a) => (
              <span
                key={a}
                className="rounded-full bg-primary-50 px-3 py-1 text-caption font-semibold text-primary-700"
              >
                {ACTIVITY_LABEL[a]}
              </span>
            ))}
          </div>
        </div>
      )}

      {c.memo && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10">
          <h3 className="mb-2 text-sm font-bold text-foreground">하고 싶은 말</h3>
          <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground">{c.memo}</p>
        </div>
      )}
    </div>
  );
}
