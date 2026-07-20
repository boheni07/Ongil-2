import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// 본문 서체는 globals.css의 Pretendard CDN import(docs/03-uiux.md §3 원문)로 처리한다.
// Geist Mono는 --font-mono 토큰(코드/숫자 고정폭 표기용)으로만 유지한다.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "온길",
  description: "장애인 생애주기 기록 플랫폼, 온길",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
      2026-07-21: body를 `min-h-full`(콘텐츠가 넘치면 그만큼 늘어나 전체 페이지가 스크롤됨)
      에서 `h-full`(정확히 뷰포트 높이로 고정)로 바꿨다 — "모든 화면이 전체 스크롤 대신
      기록관리처럼 헤더·사이드바는 고정하고 내용 영역만 스크롤"이라는 요청 반영. 이 한 줄이
      전체 체인의 시작점이고, `(app)/layout.tsx`의 main이 `min-h-0 overflow-y-auto`로
      실제 스크롤 컨테이너 역할을 이어받는다.
    */
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`}>
      <body className="h-full flex flex-col font-sans">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
