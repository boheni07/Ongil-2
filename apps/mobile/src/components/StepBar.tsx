import { StyleSheet, Text, View } from "react-native";
import { NEUTRAL, PRIMARY } from "../theme/colors";

/** 위저드 진행 표시. 회원가입(4단계)·일지(5단계)·당사자 등록(6단계) 공용. */
export function StepBar({
  current,
  total = 4,
  label = "회원가입",
}: {
  current: number;
  total?: number;
  label?: string;
}) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} ${total}단계 중 ${current}단계`}
    >
      {steps.map((n, idx) => {
        const done = n <= current;
        return (
          <View key={n} style={styles.seg}>
            <View style={[styles.dot, done && styles.dotOn]}>
              <Text style={[styles.dotText, done && styles.dotTextOn]}>{n}</Text>
            </View>
            {idx < steps.length - 1 ? (
              <View style={[styles.bar, n < current && styles.barOn]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  seg: { flexDirection: "row", alignItems: "center" },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NEUTRAL.surface,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOn: { backgroundColor: PRIMARY[600], borderColor: PRIMARY[600] },
  dotText: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textMuted },
  dotTextOn: { color: "#fff" },
  bar: { width: 24, height: 2, backgroundColor: NEUTRAL.border },
  barOn: { backgroundColor: PRIMARY[600] },
});
