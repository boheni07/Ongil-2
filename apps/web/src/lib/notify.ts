import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/notification-types";

export type { NotificationType } from "@/lib/notification-types";

export interface NotifyContent {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * 일반 알림(notifications) best-effort 발송 헬퍼 — `logAccess`(access-log.ts)와 동일한 컨벤션.
 * 확인(Confirmation) 절차와 무관한 일반 알림 전용이다(§4-6 확인 트리거는 DB에서 자동 처리).
 *
 * `handovers`·`records/eval`·`records/case-notes` 3곳에 중복 구현돼 있던 "recipientIds
 * 계산 → notifications.insert → try/catch 무시" 골격을 통합한다(2026-07-18, CTO팀 갭분석 Wave A).
 * recipientIds 자체를 어떻게 산출할지(권한 보유자 조회, guardians 조회 등)는 기능마다 달라
 * 이 함수의 책임이 아니다 — 호출부가 계산해서 넘긴다.
 *
 * 알림 발송 실패가 원래 작업(레코드 저장)을 막으면 안 되므로 모든 오류를 삼킨다.
 */
export async function notifyRecipients(
  recipientIds: Iterable<string>,
  notification: NotifyContent
): Promise<void> {
  try {
    const ids = [...new Set(recipientIds)];
    if (ids.length === 0) return;

    const supabase = await createClient();
    await supabase.from("notifications").insert(
      ids.map((rid) => ({
        recipient_id: rid,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data ?? {},
      }))
    );
  } catch {
    // 알림 실패는 무시(부가 기능) — 저장은 이미 완료된 뒤라 롤백하지 않는다.
  }
}
