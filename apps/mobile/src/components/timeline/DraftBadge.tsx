import { StyleSheet, Text, View } from "react-native";
import { NEUTRAL, RADIUS } from "../../theme/colors";

/**
 * DraftBadge(§6-2) — 카드 우상단 "임시저장" 뱃지. is_draft=true인 기록에 노출한다.
 * 카드 컨테이너 내부에 절대 배치되므로 부모 View 기준으로 우상단에 고정된다.
 */
export function DraftBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="임시저장 상태">
      <Text style={styles.text}>임시저장</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: NEUTRAL.surface,
    borderColor: NEUTRAL.border,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: { fontSize: 11, fontWeight: "700", color: NEUTRAL.textMuted },
});
