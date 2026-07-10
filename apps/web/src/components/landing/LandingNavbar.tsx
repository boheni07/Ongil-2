"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const MENU = [
  { href: "#s-intro", label: "플랫폼 소개" },
  { href: "#s-domain", label: "6개 도메인" },
  { href: "#s-role", label: "역할별 서비스" },
  { href: "#s-security", label: "보안" },
];

/**
 * 랜딩 상단 내비게이션. 히어로 위에 겹쳐 기본 투명이며, 스크롤(>60px) 시 흰 배경으로 전환한다.
 * 프로토타입(web-common.html #lpNav)의 scroll 토글 동작을 클라이언트 컴포넌트로 재현.
 */
export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={
        "sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 transition-colors sm:px-10 " +
        (scrolled
          ? "bg-white/95 shadow-[0_1px_12px_rgba(0,0,0,0.08)] backdrop-blur"
          : "bg-transparent")
      }
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight"
        aria-label="온길 홈"
      >
        <span className={scrolled ? "text-primary-600" : "text-white"}>온</span>
        <span className={scrolled ? "text-accent-stone" : "text-white"}>길</span>
      </Link>

      <div
        className={
          "hidden gap-6 text-sm font-semibold md:flex " +
          (scrolled ? "text-accent-stone" : "text-white/85")
        }
      >
        {MENU.map((m) => (
          <a key={m.href} href={m.href} className="hover:opacity-80">
            {m.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          render={<Link href="/signup" />}
          size="lg"
          className="rounded-full bg-accent-amber px-5 font-bold text-primary-900 hover:bg-accent-amber/90"
        >
          시작하기 →
        </Button>
        <button
          type="button"
          aria-label="메뉴 열기"
          aria-expanded="false"
          className={
            "flex h-11 w-11 items-center justify-center text-2xl leading-none md:hidden " +
            (scrolled ? "text-accent-stone" : "text-white")
          }
        >
          ≡
        </button>
      </div>
    </nav>
  );
}
