import { cn } from "@/lib/utils";

/**
 * docs/03-uiux.md §6-7 기록 확인(Confirmation) 컴포넌트 — `ConfirmBadge`.
 * "승인/반려"가 아닌 "확인" 개념만 표현한다: 미확인(확인 대기) / 확인됨 두 상태뿐이며
 * 되돌리기·반려 사유 같은 UI는 두지 않는다.
 *
 * `requires_confirmation=false`인 기록(관찰기록·일지 등)에는 이 배지를 아예 렌더링하지
 * 않는다 — 호출하는 쪽에서 `requiresConfirmation`이 false면 컴포넌트를 렌더하지 않도록 한다.
 */
export interface ConfirmBadgeProps {
  /** 확인 완료 시각(ISO). null/undefined면 "확인 대기" 상태로 표시 */
  confirmedAt?: string | null;
  /** 확인 주체 이름. 확인 완료 상태에서만 사용 */
  confirmerName?: string | null;
  className?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function ConfirmBadge({ confirmedAt, confirmerName, className }: ConfirmBadgeProps) {
  const isConfirmed = Boolean(confirmedAt);

  return (
    <span
      data-slot="confirm-badge"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-(--br-sm) px-2 text-[12px] font-medium leading-none",
        isConfirmed ? "bg-primary-50 text-primary-700" : "bg-[#F3F4F6] text-[#6B7280]",
        className
      )}
    >
      <span aria-hidden="true">{isConfirmed ? "✓" : "⏳"}</span>
      {isConfirmed && confirmedAt ? (
        <span>
          {confirmerName ? `${confirmerName}님 확인 · ` : "확인 · "}
          {formatDate(confirmedAt)}
        </span>
      ) : (
        <span>확인 대기</span>
      )}
    </span>
  );
}
