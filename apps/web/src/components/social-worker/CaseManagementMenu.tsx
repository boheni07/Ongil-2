"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLinkItem,
} from "@/components/ui/dropdown-menu";

/**
 * Wave M-3(docs/11-livinglab-mega-workshop.md) — 사회복지사가 법률·권리 기록(LEG)과
 * 사례회의록(WEL-006)을 함께 관리하는데 대시보드 진입점이 따로 있어 오가기 불편하다는
 * 리빙랩 피드백(사용자 J)에 따라 두 버튼을 하나의 드롭다운으로 통합한다. 두 화면 자체(LEG 허브·
 * 사례회의록 목록)는 그대로 두고 진입점만 합친다 — 데이터 모델이 다른 두 기능을 억지로
 * 한 화면에 합치는 것보다 안전하고 범위가 작다.
 */
export function CaseManagementMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="h-11 px-5 font-bold" />}
      >
        📁 법률·복지 기록 관리 ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem render={<Link href="/records/leg" />}>
          ⚖️ 법률·권리 기록
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link href="/records/case-notes" />}>
          📝 사례회의록
        </DropdownMenuLinkItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
