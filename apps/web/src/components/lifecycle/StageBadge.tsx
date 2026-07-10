"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Person } from "@ongil/shared";

/**
 * docs/03-uiux.md §6-6 생애주기 단계 컴포넌트 — `StageBadge`.
 * `life_stage` 값(child/youth_transition/adult)에 따라 아이콘+라벨+색상을 표시하고,
 * 클릭 시 단계 정의 툴팁을 보여준다. 색상은 도메인 톤을 재사용하되(edu/tra/dai bg)
 * 텍스트 굵기(700)와 좌측 4px 색상 바로 "상태 배지"임을 시각적으로 구분한다.
 * 접근성(WCAG 1.4.1): 색상만으로 구분하지 않고 항상 아이콘+텍스트 라벨을 함께 표시한다.
 */

export type LifeStage = Person["lifeStage"];

interface StageMeta {
  label: string;
  icon: string;
  description: string;
  bgClass: string;
  textClass: string;
  barClass: string;
}

const STAGE_META: Record<LifeStage, StageMeta> = {
  child: {
    label: "아동기",
    icon: "🧒",
    description: "만 14세 미만 — 보호자가 기록·동의를 대리합니다.",
    bgClass: "bg-domain-edu-bg",
    textClass: "text-domain-edu-text",
    barClass: "bg-domain-edu-accent",
  },
  youth_transition: {
    label: "청소년 전환기",
    icon: "🌱",
    description: "만 14세~17세 — 전환 계획과 당사자 의사 반영이 시작됩니다.",
    bgClass: "bg-domain-tra-bg",
    textClass: "text-domain-tra-text",
    barClass: "bg-domain-tra-accent",
  },
  adult: {
    label: "성년기",
    icon: "🧑",
    description: "만 18세 이상 — 당사자 본인이 기록·동의의 주체가 됩니다.",
    bgClass: "bg-domain-dai-bg",
    textClass: "text-domain-dai-text",
    barClass: "bg-domain-dai-accent",
  },
};

export interface StageBadgeProps {
  lifeStage: LifeStage;
  className?: string;
}

export function StageBadge({ lifeStage, className }: StageBadgeProps) {
  const meta = STAGE_META[lifeStage];

  return (
    <Tooltip>
      <TooltipTrigger
        data-slot="stage-badge"
        aria-label={`생애주기 단계: ${meta.label}. 눌러서 설명 보기`}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 overflow-hidden rounded-(--br-sm) border border-transparent pr-3 pl-0 text-sm font-bold outline-none",
          "focus-visible:border-2 focus-visible:border-[#1D9E75]",
          meta.bgClass,
          meta.textClass,
          className
        )}
      >
        <span aria-hidden="true" className={cn("h-full w-1 self-stretch", meta.barClass)} />
        <span aria-hidden="true" className="text-base leading-none">
          {meta.icon}
        </span>
        <span>{meta.label}</span>
      </TooltipTrigger>
      <TooltipContent>{meta.description}</TooltipContent>
    </Tooltip>
  );
}
