"use client";

import type { ReactNode } from "react";
import { LayoutDashboard, TrendingUp, FolderOpen, Lock, ScrollText, Settings } from "lucide-react";
import { Sidebar, type SidebarItem } from "@/components/layout/Sidebar";
import { useCurrentPerson } from "./CurrentPersonProvider";

/**
 * 보호자 사이드바 — 당사자별 항목(타임라인/기록 관리/권한 관리/접근 로그)이 헤더 콤보박스·
 * PersonSlider와 공유하는 CurrentPersonProvider의 personId를 그대로 참조해, 선택을 바꾸면
 * 페이지 이동 없이 바로 다음 클릭 목적지가 바뀐다(과거엔 항상 첫 번째 당사자로 고정 연결됐음).
 */
export function GuardianSidebar({ footer }: { footer?: ReactNode }) {
  const { personId: p } = useCurrentPerson();

  const items: SidebarItem[] = [
    { label: "대시보드", href: "/dashboard", icon: <LayoutDashboard /> },
    { label: "생애주기 타임라인", href: p ? `/persons/${p}/timeline` : "/dashboard", icon: <TrendingUp /> },
    { label: "기록 관리", href: p ? `/persons/${p}/records` : "/dashboard", icon: <FolderOpen /> },
    { label: "권한 관리", href: p ? `/persons/${p}/permissions` : "/dashboard", icon: <Lock /> },
    { label: "접근 로그", href: p ? `/persons/${p}/access-logs` : "/dashboard", icon: <ScrollText /> },
    { label: "동의·권리 관리", href: "/settings/privacy", icon: <Settings /> },
  ];

  return <Sidebar items={items} footer={footer} />;
}
