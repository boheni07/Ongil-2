import Link from "next/link";

/**
 * 설정 인덱스 — 사이드바 "설정"(보호자·지원사 등)의 진입점. 현재는 개인정보·동의 관리(G-65/P-23)
 * 한 항목만 연결한다. 항목이 늘어나면 이 목록에 추가한다.
 */
export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-headline-1 font-extrabold text-foreground">설정</h1>
      <ul className="mt-6 flex flex-col gap-2">
        <li>
          <Link
            href="/settings/privacy"
            className="flex items-center justify-between rounded-(--br-md) bg-white px-4 py-4 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
          >
            <span className="flex flex-col">
              <span className="text-body font-semibold text-foreground">개인정보·동의 관리</span>
              <span className="mt-0.5 text-caption text-muted-foreground">
                동의 현황 확인, 데이터 내보내기, 계정 비활성화
              </span>
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
