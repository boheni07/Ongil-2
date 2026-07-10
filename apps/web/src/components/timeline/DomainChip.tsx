import { cn } from "@/lib/utils";
import type { DomainKey } from "@ongil/shared";

/**
 * docs/03-uiux.md §6-2 `DomainChip` — 도메인 색상 칩, 12px 폰트.
 * 색상은 packages/shared/src/domain-colors.ts(DOMAIN_COLORS)와 동일한 값을
 * apps/web/src/app/globals.css의 `domain-{key}-{bg,text,accent}` 토큰으로 매핑해 사용한다.
 */

const DOMAIN_LABELS: Record<DomainKey, string> = {
  MED: "의료",
  EDU: "교육",
  WEL: "복지",
  DAI: "일상",
  TRA: "전환",
  LEG: "법률",
};

const DOMAIN_CLASS: Record<DomainKey, string> = {
  MED: "bg-domain-med-bg text-domain-med-text border-domain-med-accent",
  EDU: "bg-domain-edu-bg text-domain-edu-text border-domain-edu-accent",
  WEL: "bg-domain-wel-bg text-domain-wel-text border-domain-wel-accent",
  DAI: "bg-domain-dai-bg text-domain-dai-text border-domain-dai-accent",
  TRA: "bg-domain-tra-bg text-domain-tra-text border-domain-tra-accent",
  LEG: "bg-domain-leg-bg text-domain-leg-text border-domain-leg-accent",
};

export interface DomainChipProps {
  domain: DomainKey;
  /** 기본 한글 라벨(의료/교육/...) 대신 표시할 텍스트가 필요하면 지정 */
  label?: string;
  className?: string;
}

export function DomainChip({ domain, label, className }: DomainChipProps) {
  return (
    <span
      data-slot="domain-chip"
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-(--br-sm) border px-2 text-[12px] font-medium leading-none",
        DOMAIN_CLASS[domain],
        className
      )}
    >
      {label ?? DOMAIN_LABELS[domain]}
    </span>
  );
}
