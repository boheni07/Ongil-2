/**
 * notifications.type 관련 타입·라벨 — 서버 전용 의존성(next/headers)이 없는 순수 모듈.
 * `lib/notify.ts`(발송 헬퍼, 서버 전용 Supabase client 사용)에서 분리한 이유: 클라이언트
 * 컴포넌트(알림함 목록 등)가 라벨만 필요해도 notify.ts를 import하면 서버 전용 코드까지
 * 클라이언트 번들에 딸려 들어가 빌드가 깨진다(2026-07-18 Wave D-1에서 발견).
 */

/** notifications.type — supabase/prisma/schema.prisma NotificationType enum과 1:1. */
export type NotificationType =
  | "record_new"
  | "permission_grant"
  | "handover"
  | "reminder"
  | "record_confirm"
  | "life_stage_youth"
  | "life_stage_adult"
  | "life_stage_senior"
  | "permission_expiry_warning"
  | "permission_audit_summary";

/** notifications.type → 표시용 한글 라벨(알림함 G-05·GlobalHeader 배지 공용). */
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  record_new: "새 기록",
  permission_grant: "권한 변경",
  handover: "인계인수",
  reminder: "리마인더",
  record_confirm: "기록 확인 요청",
  life_stage_youth: "생애주기 전환(청소년)",
  life_stage_adult: "생애주기 전환(성인)",
  life_stage_senior: "생애주기 전환(노년)",
  permission_expiry_warning: "권한 만료 예정",
  permission_audit_summary: "권한 감사 요약",
};
