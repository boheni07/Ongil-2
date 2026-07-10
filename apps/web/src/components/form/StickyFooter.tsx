import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * docs/03-uiux.md §6-1 `StickyFooter` — 폼 하단 저장/다음 CTA.
 * WizardForm 등 다단계 폼 하단에 고정되어 이전/임시저장/다음(또는 제출) 액션을 노출한다.
 */
export interface StickyFooterProps {
  onBack?: () => void;
  backLabel?: string;
  onSaveDraft?: () => void;
  saveDraftLabel?: string;
  onPrimary?: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  /** 커스텀 콘텐츠가 필요하면 액션 버튼 대신 사용 */
  children?: ReactNode;
  className?: string;
}

export function StickyFooter({
  onBack,
  backLabel = "이전",
  onSaveDraft,
  saveDraftLabel = "임시저장",
  onPrimary,
  primaryLabel = "다음",
  primaryDisabled,
  children,
  className,
}: StickyFooterProps) {
  return (
    <div
      data-slot="sticky-footer"
      className={cn(
        "sticky bottom-0 z-10 flex min-h-11 items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur",
        className
      )}
    >
      {children ?? (
        <>
          <div className="flex items-center gap-2">
            {onBack ? (
              <Button type="button" variant="outline" onClick={onBack}>
                {backLabel}
              </Button>
            ) : (
              <span />
            )}
            {onSaveDraft ? (
              <Button type="button" variant="ghost" onClick={onSaveDraft}>
                {saveDraftLabel}
              </Button>
            ) : null}
          </div>
          {onPrimary ? (
            <Button type="button" onClick={onPrimary} disabled={primaryDisabled}>
              {primaryLabel}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
