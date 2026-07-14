import type { RoadmapStage } from "@ongil/validation";
import { cn } from "@/lib/utils";

/**
 * W-16 전환 로드맵 시각화 — docs/03-uiux.md:316-319.
 * [탐색] ──▶ [계획] ──▶ [훈련] ──▶ [취업/자립]  ← 현재 위치 ●
 * 4단계를 가로로 나열하고 현재 roadmap_stage에 강조 마커(●)를 표시한다.
 *
 * onChange가 있으면 각 단계를 클릭 가능한 버튼으로(위저드 stage 선택 입력),
 * 없으면 순수 읽기 전용 시각화로 렌더한다(요약·목록 카드 재사용).
 */

const STAGES: { value: RoadmapStage; label: string }[] = [
  { value: "exploration", label: "탐색" },
  { value: "planning", label: "계획" },
  { value: "training", label: "훈련" },
  { value: "employment", label: "취업·자립" },
];

export interface RoadmapProgressProps {
  stage: RoadmapStage;
  /** 있으면 각 단계가 클릭 가능한 선택 입력이 된다(위저드용). */
  onChange?: (stage: RoadmapStage) => void;
  className?: string;
}

export function RoadmapProgress({ stage, onChange, className }: RoadmapProgressProps) {
  const currentIndex = STAGES.findIndex((s) => s.value === stage);
  const interactive = Boolean(onChange);

  return (
    <div
      className={cn("flex items-stretch gap-1", className)}
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? "전환 로드맵 단계 선택" : `전환 로드맵 현재 단계: ${STAGES[currentIndex]?.label ?? "미정"}`}
    >
      {STAGES.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isPast = currentIndex >= 0 && i < currentIndex;
        const cell = (
          <div
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-(--br-md) border px-2 py-2 text-center transition-colors",
              isCurrent
                ? "border-domain-tra-accent bg-domain-tra-bg text-domain-tra-text"
                : isPast
                  ? "border-domain-tra-accent/40 bg-domain-tra-bg/40 text-domain-tra-text/70"
                  : "border-border bg-white text-muted-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "text-sm leading-none",
                isCurrent ? "text-domain-tra-text" : "text-transparent"
              )}
            >
              ●
            </span>
            <span className={cn("text-caption font-bold", isCurrent && "text-body")}>{s.label}</span>
          </div>
        );

        return (
          <div key={s.value} className="flex flex-1 items-center gap-1">
            {interactive ? (
              <button
                type="button"
                role="radio"
                aria-checked={isCurrent}
                onClick={() => onChange?.(s.value)}
                className="flex-1 outline-none focus-visible:rounded-(--br-md) focus-visible:ring-2 focus-visible:ring-[#1D9E75]"
              >
                {cell}
              </button>
            ) : (
              <div className="flex-1">{cell}</div>
            )}
            {i < STAGES.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "shrink-0 text-sm font-bold",
                  i < currentIndex ? "text-domain-tra-accent" : "text-muted-foreground/50"
                )}
              >
                ▶
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
