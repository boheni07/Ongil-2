import Link from "next/link";

/**
 * 랜딩 하단 푸터. 랜딩(`/`)뿐 아니라 지원·약관 등 콘텐츠 페이지(`(public)/(content)/layout.tsx`)에서도
 * 공유해 "다른 화면으로 전환된 느낌"이 들지 않도록 동일한 레이아웃을 유지한다.
 */
export function LandingFooter() {
  return (
    <footer className="bg-accent-stone px-6 pt-14 pb-10 text-[#cfceca] sm:px-10">
      <div className="mx-auto grid max-w-[1120px] gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3 text-xl font-extrabold tracking-tight text-white">
            온길
          </div>
          <p className="max-w-[280px] text-[13px]">
            장애인의 생애 전체를 당사자 중심으로 기록하고 연결하는 생애주기
            플랫폼
          </p>
        </div>
        <nav aria-label="서비스">
          <h3 className="mb-3.5 text-sm text-white">서비스</h3>
          <a href="/#s-intro" className="mb-2.5 block text-[13px] hover:text-white">
            플랫폼 소개
          </a>
          <a href="/#s-domain" className="mb-2.5 block text-[13px] hover:text-white">
            6개 도메인
          </a>
          <a href="/#s-role" className="mb-2.5 block text-[13px] hover:text-white">
            역할별 서비스
          </a>
        </nav>
        <nav aria-label="지원">
          <h3 className="mb-3.5 text-sm text-white">지원</h3>
          <Link href="/support" className="mb-2.5 block text-[13px] hover:text-white">
            이용 안내
          </Link>
          <Link
            href="/support/faq"
            className="mb-2.5 block text-[13px] hover:text-white"
          >
            자주 묻는 질문
          </Link>
          <Link
            href="/support/contact"
            className="mb-2.5 block text-[13px] hover:text-white"
          >
            문의하기
          </Link>
        </nav>
        <nav aria-label="약관">
          <h3 className="mb-3.5 text-sm text-white">약관</h3>
          <Link href="/legal/terms" className="mb-2.5 block text-[13px] hover:text-white">
            이용약관
          </Link>
          <Link
            href="/legal/privacy"
            className="mb-2.5 block text-[13px] hover:text-white"
          >
            개인정보처리방침
          </Link>
        </nav>
      </div>
      <div className="mx-auto mt-9 flex max-w-[1120px] flex-wrap justify-between gap-2 border-t border-white/10 pt-[22px] text-xs text-[#9d9c96]">
        <span>© 2026 온길(Ongil). All rights reserved.</span>
        <span>내 삶의 모든 길이 여기 있습니다</span>
      </div>
    </footer>
  );
}
