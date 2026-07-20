import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WeeklyTaskItem } from "../../lib/weekly-tasks";
import { Card } from "../Card";
import { FONT, NEUTRAL, SPACING } from "../../theme/colors";

/**
 * docs/14 워크숍 Wave W-2/W-4 — 마감일 기반 "이번 주 처리할 일" 공용 카드(모바일).
 * 웹 WeeklyTaskCard.tsx 동형. 특수교사·사회복지사 홈에서 재사용한다.
 */
export function WeeklyTaskCard({ items }: { items: WeeklyTaskItem[] }) {
  return (
    <Card>
      <Text style={styles.title}>📅 이번 주 처리할 일</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>이번 주 마감인 항목이 없습니다.</Text>
      ) : (
        items.map((item, i) => (
          <Pressable
            key={`${item.personId}-${item.recordType}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.personName} ${item.label}, ${item.dday < 0 ? `기한 ${Math.abs(item.dday)}일 초과` : `디데이 ${item.dday}`}`}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.row,
              i === items.length - 1 && styles.rowLast,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.dot, { backgroundColor: item.dday < 0 ? NEUTRAL.danger : item.dday <= 2 ? "#E8991E" : "#0F6E56" }]} />
            <Text style={styles.rowText} numberOfLines={1}>
              {item.personName} · {item.label}
            </Text>
            <Text style={[styles.dday, item.dday < 0 && styles.ddayOver]}>
              {item.dday < 0 ? `기한 ${Math.abs(item.dday)}일 초과` : `D-${item.dday}`}
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowText: { flex: 1, fontSize: 13, color: NEUTRAL.text },
  dday: { fontSize: 13, fontWeight: "700", color: NEUTRAL.text },
  ddayOver: { color: NEUTRAL.danger },
});
