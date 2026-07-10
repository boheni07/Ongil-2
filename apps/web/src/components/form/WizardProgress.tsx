import { cn } from "@/lib/utils";

/**
 * 위저드 진행 표시 — P-02(4단계)·S-12(5단계)·당사자 등록(6단계) 공용.
 * 점(dot) 나열 + "현재/전체 · 라벨" 텍스트. auth의 StepBar와 달리 단계 수가 가변이라 별도 컴포넌트.
 */
export interface WizardProgressProps {
  current: number;
  total: number;
  label?: string;
  /** 당사자 모드처럼 큰 타깃이 필요하면 person 사이즈 */
  size?: "default" | "person";
  className?: string;
}

export function WizardProgress({ current, total, label, size = "default", className }: WizardProgressProps) {
  const dots = Array.from({ length: total }, (_, i) => i + 1);
  const person = size === "person";
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <ol className="flex items-center gap-2" aria-hidden="true">
        {dots.map((step) => (
          <li
            key={step}
            className={cn(
              "rounded-full transition-colors",
              person ? "h-2.5 w-2.5" : "h-2 w-2",
              step <= current ? "bg-primary-600" : "bg-muted"
            )}
          />
        ))}
      </ol>
      <span
        className={cn(
          "font-semibold text-accent-stone",
          person ? "text-person-base" : "text-sm"
        )}
      >
        {current}/{total}
        {label ? ` · ${label}` : ""}
      </span>
    </div>
  );
}
