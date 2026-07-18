import { cn } from "@/lib/utils";

/**
 * 회원가입 2단계 인디케이터 — 정보 입력(역할·기본정보·동의 통합 화면) → 이메일 인증.
 * 2026-07-18 이전엔 4단계(역할선택/기본정보/동의/인증)였으나 앞 3단계를 한 화면으로
 * 병합했다(사용자 피드백: "회원가입도 단계별 진행이 아니라 한 화면에서 처리되면 좋겠다").
 * 이메일 인증만은 Supabase 이메일 확인의 비동기 특성상 별도 단계로 남는다.
 */
const STEPS = ["정보 입력", "이메일 인증"] as const;

export function StepBar({ current }: { current: 1 | 2 }) {
  return (
    <ol
      className="mb-7 flex items-center"
      aria-label={`회원가입 진행 단계 ${current}/2: ${STEPS[current - 1]}`}
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
