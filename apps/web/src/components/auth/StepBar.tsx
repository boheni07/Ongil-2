import { cn } from "@/lib/utils";

/**
 * 회원가입 위저드 4단계 인디케이터(A-03/A-04/A-08/A-05 공유).
 * 순서: 1=역할선택 · 2=기본정보 · 3=동의 · 4=인증
 */
const STEPS = ["역할 선택", "기본 정보", "약관 동의", "이메일 인증"] as const;

export function StepBar({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol
      className="mb-7 flex items-center"
      aria-label={`회원가입 진행 단계 ${current}/4: ${STEPS[current - 1]}`}
    >
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step <= current;
        return (
          <li
            key={label}
            className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                done
                  ? "bg-primary-600 text-white"
                  : "bg-muted text-muted-foreground"
              )}
              aria-current={step === current ? "step" : undefined}
            >
              {step}
            </div>
            {i < STEPS.length - 1 && (
              <div
                aria-hidden="true"
                className={cn(
                  "mx-2 h-0.5 flex-1 rounded-full",
                  step < current ? "bg-primary-600" : "bg-muted"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
