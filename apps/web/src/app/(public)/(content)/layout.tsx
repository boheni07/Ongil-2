import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";

/**
 * 지원(이용안내·FAQ·문의하기)·약관 등 로그인 불필요한 콘텐츠 페이지 공용 레이아웃.
 * 랜딩(`/`)과 같은 내비게이션·푸터를 둘러 "다른 화면으로 전환된" 느낌 없이 랜딩의
 * 연장선으로 보이게 한다 — 히어로가 없으므로 내비게이션은 처음부터 흰 배경(forceSolid)으로 표시.
 * (auth)/layout.tsx의 로그인·가입용 중앙 카드 레이아웃과는 의도적으로 분리했다.
 */
export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-accent-stone">
      <LandingNavbar forceSolid />
      <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
