"use client";

import { Button } from "@/components/ui/button";

/**
 * docs/03-uiux.md §6-7 기록 확인(Confirmation) 컴포넌트 — `ConfirmCTA`.
 * "승인/반려"가 아닌 "확인" 액션만 담는 재사용 버튼이다. 확인 주체(보호자·성년 당사자 본인)가
 * 내용을 확인했음을 남기는 단일 버튼이며, 되돌리기·거부 같은 UI는 두지 않는다.
 * label 기본값은 보호자 문맥의 "확인했습니다", P-10 당사자 문맥은 "이 기록을 봤어요"로 오버라이드한다.
 */
export interface ConfirmCTAProps {
  onConfirm: () => Promise<void> | void;
  busy?: boolean;
  label?: string;
  className?: string;
}

export function ConfirmCTA({
  onConfirm,
  busy = false,
  label = "확인했습니다",
  className,
}: ConfirmCTAProps) {
  return (
    <Button
      type="button"
      className={className ?? "h-11 font-bold"}
      disabled={busy}
      onClick={() => void onConfirm()}
    >
      {busy ? "처리 중..." : label}
    </Button>
  );
}
