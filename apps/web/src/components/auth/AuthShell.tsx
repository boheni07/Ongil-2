import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * 인증 플로우 공용 카드. 폭은 화면별로 지정(기본 narrow).
 * xwide는 역할선택+기본정보+동의를 한 화면에 담는 통합 회원가입 전용 — 데스크톱에서
 * 2단 레이아웃을 펼칠 수 있는 폭을 준다(2026-07-19, "회원가입이 모바일 폭 그대로"라는
 * 피드백 반영).
 */
export function AuthCard({
  width = "narrow",
  className,
  children,
}: {
  width?: "narrow" | "wide" | "xwide";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl bg-card p-8 shadow-sm ring-1 ring-foreground/10 sm:p-10",
        width === "xwide" ? "max-w-4xl" : width === "wide" ? "max-w-xl" : "max-w-md",
        className
      )}
    >
      {children}
    </div>
  );
}

/** 온길 워드마크 — 카드 상단 브랜드 표시 */
export function AuthLogo() {
  return (
    <Link
      href="/"
      aria-label="온길 홈으로"
      className="mb-6 inline-flex items-center gap-2 text-xl font-extrabold tracking-tight"
    >
      <span aria-hidden="true" className="text-primary-700">
        온
      </span>
      <span aria-hidden="true" className="-ml-1.5 text-accent-amber">
        길
      </span>
    </Link>
  );
}

export function AuthTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
      {children}
    </h1>
  );
}

export function AuthDesc({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm text-muted-foreground">{children}</p>;
}

/** 폼 입력 공용 스타일 — 44px 이상 터치 타겟(h-12) 확보 */
export const authFieldClass =
  "h-12 w-full rounded-[10px] border border-border bg-background px-3.5 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary-600";

/** 인증 플로우 기본 버튼 스타일(초록 primary, full-width, 48px) */
export const authButtonClass =
  "h-12 w-full rounded-[10px] text-[15px] font-bold";
