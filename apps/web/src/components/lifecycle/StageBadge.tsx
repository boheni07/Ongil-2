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
  /** 당사자 모드(simple)용 짧고 쉬운 단어. */
  simpleLabel: string;
  icon: string;
  description: string;
  bgClass: string;
  textClass: string;
  barClass: string;
}

const STAGE_META: Record<LifeStage, StageMeta> = {
  infant: {
    label: "영유아기",
    simpleLabel: "아기 때",
    icon: "🍼",
    description: "만 0~5세 — 조기 진단·개입 시기로, 보호자가 기록·동의를 대리합니다.",
    bgClass: "bg-domain-wel-bg",
    textClass: "text-domain-wel-text",
    barClass: "bg-domain-wel-accent",
  },
  child: {
    label: "아동기",
    simpleLabel: "어린이 때",
    icon: "🧒",
    description: "만 6~12세 — 보호자가 기록·동의를 대리합니다.",
    bgClass: "bg-domain-edu-bg",
    textClass: "text-domain-edu-text",
    barClass: "bg-domain-edu-accent",
  },
  youth_transition: {
    label: "청소년 전환기",
    simpleLabel: "청소년",
    icon: "🌱",
    description: "만 13세~18세 — 전환 계획과 당사자 의사 반영이 시작됩니다.",
    bgClass: "bg-domain-tra-bg",
    textClass: "text-domain-tra-text",
    barClass: "bg-domain-tra-accent",
  },
  adult: {
    label: "성인기",
    simpleLabel: "어른",
    icon: "🧑",
    description: "만 19세~64세 — 당사자 본인이 기록·동의의 주체가 됩니다.",
    bgClass: "bg-domain-dai-bg",
    textClass: "text-domain-dai-text",
    barClass: "bg-domain-dai-accent",
  },
  senior: {
    label: "노년기",
    simpleLabel: "어르신",
    icon: "👵",
    description: "만 65세 이상 — 돌봄·후견 관련 지원이 중요해지는 시기입니다. 당사자 본인이 계속 주체입니다.",
    bgClass: "bg-domain-leg-bg",
    textClass: "text-domain-leg-text",
    barClass: "bg-domain-leg-accent",
  },
};

export interface StageBadgeProps {
  lifeStage: LifeStage;
  className?: string;
  /**
   * 당사자 모드 변형(P-01). 쉬운 단어(예: 🧒 어린이 때)만 큰 글씨로 보여주고
   * 툴팁·설명 문구는 생략한다(인지 부담 최소화). 기본은 false — 기존 사용처는 그대로.
   */
  simple?: boolean;
  /**
   * false면 툴팁 트리거(button) 없이 순수 `<span>`으로 렌더한다.
   * 카드 전체가 `<Link>`(`<a>`)인 목록 항목 안에 배지를 넣을 때 반드시 false로 써야
   * `<a>` 안에 `<button>`이 중첩되는 무효 DOM/hydration 경고를 막을 수 있다.
   * 기본은 true(기존 사용처 동작 유지).
   */
  interactive?: boolean;
}

export function StageBadge({ lifeStage, className, simple = false, interactive = true }: StageBadgeProps) {
  const meta = STAGE_META[lifeStage];

  if (simple || !interactive) {
    const label = simple ? meta.simpleLabel : meta.label;
    return (
      <span
        data-slot="stage-badge"
        role="img"
        aria-label={`생애주기 단계: ${label}`}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 overflow-hidden rounded-(--br-sm) pr-4 pl-0 font-bold",
          simple ? "text-person-base" : "text-sm",
          meta.bgClass,
          meta.textClass,
          className
        )}
      >
        <span aria-hidden="true" className={cn("h-full w-1 self-stretch", meta.barClass)} />
        <span aria-hidden="true" className={cn("leading-none", simple ? "text-xl" : "text-base")}>
          {meta.icon}
        </span>
        <span>{label}</span>
      </span>
    );
  }

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
