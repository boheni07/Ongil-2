import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Role } from "@ongil/validation";
import { NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";

export interface RoleOption {
  role: Role;
  emoji: string;
  title: string;
  desc: string;
  iconBg: string;
}

/** A-03 역할 선택 카드 6종 (docs/03-uiux.md 역할 색상 + 프로토타입 문구). */
export const ROLE_OPTIONS: RoleOption[] = [
  { role: "person", emoji: "🙋", title: "당사자", desc: "내 삶을 내가 기록", iconBg: "#D9F2E7" },
  { role: "guardian", emoji: "👪", title: "보호자", desc: "가족을 대신해 관리", iconBg: "#FBE7CC" },
  { role: "supporter", emoji: "🤝", title: "활동지원사", desc: "현장 활동 기록", iconBg: "#E1F5EE" },
  { role: "teacher", emoji: "🏫", title: "특수교사", desc: "IEP·관찰 기록", iconBg: "#EEF4FD" },
  { role: "social_worker", emoji: "🧑‍💼", title: "사회복지사", desc: "ISP·전환 지원", iconBg: "#EDFAF3" },
  { role: "therapist", emoji: "🩺", title: "치료사", desc: "치료계획·회기", iconBg: "#F4EFFB" },
];

export function RoleCard({
  option,
  selected,
  onPress,
}: {
  option: RoleOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${option.title} — ${option.desc}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: option.iconBg }]}>
        <Text style={styles.emoji}>{option.emoji}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{option.title}</Text>
        <Text style={styles.desc}>{option.desc}</Text>
      </View>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: TOUCH_MIN + 16,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: NEUTRAL.bg,
  },
  cardSelected: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  pressed: { opacity: 0.9 },
  icon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22 },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", color: NEUTRAL.text },
  desc: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: PRIMARY[600], borderColor: PRIMARY[600] },
  checkMark: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
