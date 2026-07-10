import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §6-1 `StepIndicator` — 다단계 진행 바.
 * `WizardForm`(§6-3) 등 다단계 폼 상단에서 "Step n/총단계" 진행 상태를 보여준다.
 */
export interface StepIndicatorProps {
  /** 전체 단계 라벨. 예: ["기분", "식사", "활동", "몸 상태"] */
  steps: string[];
  /** 0-based 현재 단계 인덱스 */
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  const total = steps.length;

  return (
    <div
      data-slot="step-indicator"
      role="group"
      aria-label={`${total}단계 중 ${currentStep + 1}단계`}
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {steps.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-(--br-sm) transition-colors",
              i <= currentStep ? "bg-primary-600" : "bg-primary-100"
            )}
          />
        ))}
      </div>
      <p className="text-label font-semibold text-accent-stone">
        {currentStep + 1}/{total} · {steps[currentStep]}
      </p>
    </div>
  );
}
