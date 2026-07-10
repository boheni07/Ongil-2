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
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
