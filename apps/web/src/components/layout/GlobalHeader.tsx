import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * docs/03-uiux.md §6-1 `GlobalHeader` — 높이 56px(`--hh`), 로고·알림.
 *
 * 2026-07-19: 우측의 아바타·드롭다운(프로필 수정/설정/로그아웃)을 사이드바 최하단
 * `UserMenu`로 옮겼다("알림은 우측 상단, 로그인 사용자는 좌측 메뉴 하단" 피드백) — 헤더에는
 * 알림 벨만 남는다. 당사자(person) 모드처럼 사이드바가 없는 레이아웃은 layout.tsx가 폰 셸
 * 하단에 `UserMenu`를 직접 배치해 동일한 메뉴를 제공한다. 순수 표시용 컴포넌트라 더 이상
 * 클라이언트 상태·서버 액션이 필요 없어 Server Component로 되돌렸다.
 */
export interface GlobalHeaderProps {
  notificationCount?: number;
  className?: string;
}

export function GlobalHeader({ notificationCount = 0, className }: GlobalHeaderProps) {
  return (
    <header
      data-slot="global-header"
      className={cn(
        "relative z-10 flex h-(--hh) items-center justify-between border-b border-border bg-white px-4 shadow-sm",
        className
      )}
    >
      <Link href="/" className="flex items-center gap-0.5 text-lg font-extrabold" aria-label="온길 홈으로 이동">
        <span className="text-primary-600">온</span>
        <span className="text-accent-stone">길</span>
      </Link>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        render={<Link href="/notifications" />}
        aria-label={notificationCount > 0 ? `알림 ${notificationCount}건` : "알림"}
        className="relative min-h-11 min-w-11"
      >
        <Bell className="size-5" aria-hidden="true" />
        {notificationCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-domain-med-accent"
          />
        ) : null}
      </Button>
    </header>
  );
}
