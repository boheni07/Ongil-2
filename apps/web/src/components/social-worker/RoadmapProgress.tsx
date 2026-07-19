import type { RoadmapStage } from "@ongil/validation";
import { cn } from "@/lib/utils";

/**
 * W-16 전환 로드맵 시각화 — 프로토타입 web-social-worker.html 391~397줄(원형 이모지 노드 +
 * 라벨 + 캡션 + 현재 단계 "● 현재 위치" 배지). 2026-07-19 이전엔 원형 노드·이모지·캡션·
 * 현재위치 배지가 전부 빠진 단순 칩 형태였다 — 프로토타입 대조로 보강.
 * 4단계를 가로로 나열하고 현재 roadmap_stage에 강조 마커를 표시한다.
 *
 * onChange가 있으면 각 단계를 클릭 가능한 버튼으로(위저드 stage 선택 입력),
 * 없으면 순수 읽기 전용 시각화로 렌더한다(요약·목록 카드 재사용).
 */

const STAGES: { value: RoadmapStage; label: string; icon: string; caption: string }[] = [
  { value: "exploration", label: "탐색", icon: "🔍", caption: "직업 흥미·적성 파악" },
  { value: "planning", label: "계획", icon: "📋", caption: "전환목표 수립" },
  { value: "training", label: "훈련", icon: "🎓", caption: "직무·자립 훈련" },
  { value: "employment", label: "취업·자립", icon: "💼", caption: "고용·지역사회 정착" },
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
      className={cn("flex items-start", className)}
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? "전환 로드맵 단계 선택" : `전환 로드맵 현재 단계: ${STAGES[currentIndex]?.label ?? "미정"}`}
    >
      {STAGES.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isPast = currentIndex >= 0 && i < currentIndex;
        const cell = (
          <div className="flex flex-col items-center text-center">
            <div className="relative w-full">
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[23px] left-1/2 h-[3px] w-full",
                    isPast || isCurrent ? "bg-domain-tra-accent" : "bg-border"
                  )}
                />
              )}
              <div
                className={cn(
                  "relative z-[1] mx-auto flex size-[46px] items-center justify-center rounded-full border-2 text-xl transition-colors",
                  isCurrent
                    ? "border-domain-tra-accent bg-white text-domain-tra-text shadow-[0_0_0_5px_var(--color-domain-tra-bg)]"
                    : isPast
                      ? "border-domain-tra-accent bg-domain-tra-accent text-white"
                      : "border-border bg-muted text-muted-foreground"
                )}
              >
                <span aria-hidden="true">{s.icon}</span>
              </div>
            </div>
            <span
              className={cn(
                "mt-2.5 text-caption font-bold",
                isCurrent ? "text-domain-tra-text" : isPast ? "text-domain-tra-text/80" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">{s.caption}</span>
            {isCurrent && (
              <span className="mt-1.5 inline-block rounded-(--br-sm) bg-domain-tra-accent px-2 py-0.5 text-[10px] font-bold text-white">
                ● 현재 위치
              </span>
            )}
          </div>
        );

        return (
          <div key={s.value} className="min-w-0 flex-1 px-1">
            {interactive ? (
              <button
                type="button"
                role="radio"
                aria-checked={isCurrent}
                onClick={() => onChange?.(s.value)}
                className="w-full outline-none focus-visible:rounded-(--br-md) focus-visible:ring-2 focus-visible:ring-[#1D9E75]"
              >
                {cell}
              </button>
            ) : (
              cell
            )}
          </div>
        );
      })}
    </div>
  );
}
