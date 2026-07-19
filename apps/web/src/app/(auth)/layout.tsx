import Link from "next/link";

/**
 * 로그인·회원가입 등 인증 화면 전 구간에 "처음으로"(랜딩) 링크를 상단 고정으로 둔다 —
 * 카드 안 로고 클릭만으로는 되돌아갈 방법이 눈에 잘 띄지 않는다는 피드백(2026-07-19) 반영.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 items-start justify-center bg-primary-50/40 px-4 py-10 dark:bg-black sm:py-16">
      <Link
        href="/"
        className="fixed top-5 left-5 z-10 flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-sm font-semibold text-muted-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-colors hover:text-primary-700 dark:bg-black/60"
      >
        <span aria-hidden="true">←</span> 처음으로
      </Link>
      {children}
    </div>
  );
}
