import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Choice } from "../lib/content";
import { NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";

/**
 * 당사자 모드 아이콘 선택기 (docs/03-uiux.md §7-1).
 * 아이콘 72×72, 최소 터치 영역 56 이상, 라벨 20px 이상, accessibilityLabel 필수.
 * single(라디오) / multi(체크박스) 두 모드를 지원한다.
 */

interface PersonIconGridProps<T extends string> {
  choices: Choice<T>[];
  /** single 모드: 선택값 하나(또는 null) / multi 모드: 선택값 배열 */
  selected: T | T[] | null;
  onSelect: (value: T) => void;
  multi?: boolean;
}

export function PersonIconGrid<T extends string>({
  choices,
  selected,
  onSelect,
  multi,
}: PersonIconGridProps<T>) {
  const isSelected = (value: T) =>
    Array.isArray(selected) ? selected.includes(value) : selected === value;

  return (
    <View style={styles.grid}>
      {choices.map((c) => {
        const sel = isSelected(c.value);
        return (
          <Pressable
            key={c.value}
            accessibilityRole={multi ? "checkbox" : "radio"}
            accessibilityState={{ selected: sel, checked: sel }}
            accessibilityLabel={c.label}
            onPress={() => onSelect(c.value)}
            style={({ pressed }) => [
              styles.tile,
              sel && styles.tileSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.icon, sel && styles.iconSelected]}>
              <Text style={styles.glyph}>{c.emoji}</Text>
            </View>
            <Text style={[styles.label, sel && styles.labelSelected]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 활동지원사 모드 카테고리 칩(복수 선택) — 일반 크기. */
export function CategoryChip({
  emoji,
  label,
  selected,
  onPress,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  tile: {
    width: "47%",
    flexGrow: 1,
    minHeight: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.lg,
    backgroundColor: NEUTRAL.bg,
  },
  tileSelected: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  pressed: { opacity: 0.85 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEUTRAL.surface,
  },
  iconSelected: { backgroundColor: "#D9F2E7" },
  glyph: { fontSize: 44, lineHeight: 52 },
  label: { fontSize: 20, fontWeight: "700", color: NEUTRAL.text, textAlign: "center" },
  labelSelected: { color: PRIMARY[800] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.bg,
  },
  chipSelected: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  chipEmoji: { fontSize: 18 },
  chipLabel: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text },
  chipLabelSelected: { color: PRIMARY[800] },
});
