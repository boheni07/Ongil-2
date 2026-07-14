import { StyleSheet, Text, View } from "react-native";
import { FONT, NEUTRAL, PRIMARY, RADIUS } from "../../theme/colors";

/**
 * docs/03-uiux.md §6-7 기록 확인(Confirmation) 배지(모바일) — 웹 ConfirmBadge와 동일 개념.
 * "확인 대기" / "확인됨" 두 상태만 표현한다. 되돌리기·반려 같은 UI는 두지 않는다.
 * requires_confirmation=false 기록에는 호출부에서 이 배지를 렌더하지 않는다.
 */
export interface ConfirmBadgeProps {
  /** 확인 완료 시각(ISO). null/undefined면 "확인 대기" 상태 */
  confirmedAt?: string | null;
  /** 확인 주체 이름. 확인 완료 상태에서만 사용 */
  confirmerName?: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function ConfirmBadge({ confirmedAt, confirmerName }: ConfirmBadgeProps) {
  const isConfirmed = Boolean(confirmedAt);
  return (
    <View style={[styles.badge, isConfirmed ? styles.done : styles.pending]}>
      <Text style={[styles.text, isConfirmed ? styles.doneText : styles.pendingText]}>
        {isConfirmed && confirmedAt
          ? `✓ ${confirmerName ? `${confirmerName}님 확인 · ` : "확인 · "}${formatDate(confirmedAt)}`
          : "⏳ 확인 대기"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pending: { backgroundColor: "#F3F4F6" },
  done: { backgroundColor: PRIMARY[50] },
  text: { fontSize: FONT.caption, fontWeight: "700" },
  pendingText: { color: NEUTRAL.textMuted },
  doneText: { color: PRIMARY[700] },
});
