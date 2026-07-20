import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "../Card";
import { DOMAIN_COLORS, FONT, NEUTRAL, SPACING } from "../../theme/colors";

export interface BacklogTaskItem {
  personId: string;
  personName: string;
  label: string;
  onPress: () => void;
}

/**
 * docs/14 워크숍 Wave W-3/W-4 — 백로그 기반 "처리 대기 중" 공용 카드(모바일).
 * 웹 BacklogTaskCard.tsx 동형. 치료사(계획서 미작성)·활동지원사(임시저장 일지)가 쓴다.
 * 날짜/D-day 개념이 없어 WeeklyTaskCard와 별도 컴포넌트다 — "이번 주"라고 억지로 우기지
 * 않는다(§2 토론 결론).
 */
export function BacklogTaskCard({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: BacklogTaskItem[];
}) {
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>{emptyText}</Text>
      ) : (
        items.map((item, i) => (
          <Pressable
            key={`${item.personId}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.personName} ${item.label}`}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.row,
              i === items.length - 1 && styles.rowLast,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.dot} />
            <Text style={styles.rowText} numberOfLines={1}>
              {item.personName} · {item.label}
            </Text>
          </Pressable>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.sm },
  muted: { fontSize: 14, color: NEUTRAL.textMuted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
  },
  rowLast: { borderBottomWidth: 0 },
  pressed: { opacity: 0.75 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DOMAIN_COLORS.DAI.accent },
  rowText: { flex: 1, fontSize: 13, color: NEUTRAL.text },
});
