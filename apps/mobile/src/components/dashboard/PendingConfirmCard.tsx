import { Pressable, StyleSheet, Text } from "react-native";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../../theme/colors";

/**
 * docs/03-uiux.md §6-7 PendingConfirmCard(모바일) — G-01 대시보드 "확인 대기 기록 N건" 요약.
 * "확인" 개념만 표현한다(승인/반려 없음). count=0이면 담백, count>0이면 강조 + 이동 유도.
 */
export interface PendingConfirmCardProps {
  count: number;
  onPress: () => void;
}

export function PendingConfirmCard({ count, onPress }: PendingConfirmCardProps) {
  const has = count > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={has ? `확인 대기 기록 ${count}건, 눌러서 보기` : "확인 대기 기록 없음"}
      onPress={onPress}
      style={({ pressed }) => [styles.card, has && styles.cardActive, pressed && styles.pressed]}
    >
      <Text style={styles.title}>확인 대기 기록</Text>
      {has ? (
        <>
          <Text style={styles.count}>{count}건</Text>
          <Text style={styles.hint}>공식 문서 내용을 확인해 주세요 · 눌러서 보기 →</Text>
        </>
      ) : (
        <Text style={styles.muted}>확인이 필요한 기록이 없습니다.</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
  },
  cardActive: {
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    backgroundColor: PRIMARY[50],
  },
  pressed: { opacity: 0.85 },
  title: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.xs },
  count: { fontSize: 22, fontWeight: "800", color: PRIMARY[700] },
  hint: { fontSize: 13, fontWeight: "600", color: PRIMARY[700], marginTop: 4 },
  muted: { fontSize: 14, color: NEUTRAL.textMuted },
});
