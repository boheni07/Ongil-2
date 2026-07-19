import Link from "next/link";

/**
 * docs/03-uiux.md §6-8 소셜 로그인 버튼(F-AUTH-02). 이메일 폼 아래 "또는 간편 시작" 구분선
 * 다음에 세로 스택으로 배치한다. 로그인·가입 진입점이 하나로 통합돼 있다 — 신규/기존 판별은
 * 콜백(A-11, apps/web/src/lib/oauth-bridge.ts)이 처리하므로 이 버튼들은 /login·/signup 어디에
 * 둬도 동일하게 동작한다.
 */
export function SocialAuthButtons() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex items-center gap-3 text-caption text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        또는 간편 시작
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <KakaoLoginButton />
      <NaverLoginButton />
    </div>
  );
}

export function KakaoLoginButton() {
  return (
    <Link
      href="/api/auth/kakao"
      className="flex min-h-14 items-center justify-center gap-2 rounded-(--br-lg) bg-[#FEE500] px-4 text-[15px] font-bold text-black/85"
    >
      <span aria-hidden="true">💬</span>
      카카오로 시작하기
    </Link>
  );
}

export function NaverLoginButton() {
  return (
    <Link
      href="/api/auth/naver"
      className="flex min-h-14 items-center justify-center gap-2 rounded-(--br-lg) bg-[#03C75A] px-4 text-[15px] font-bold text-white"
    >
      <span aria-hidden="true">N</span>
      네이버로 시작하기
    </Link>
  );
}
