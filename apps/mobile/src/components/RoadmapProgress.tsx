import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RoadmapStage } from "@ongil/validation";
import { NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";

/**
 * W-16 전환 로드맵 시각화 (docs/03-uiux.md:316-319).
 * [탐색] → [계획] → [훈련] → [취업/자립] 4단계를 가로로 나열하고 현재 단계에 마커(●)를 얹는다.
 * onChange가 있으면 각 단계가 선택 입력(터치 영역 44px+)으로, 없으면 읽기 전용으로 동작한다.
 * 모바일 화면 폭을 넘칠 수 있어 가로 스크롤로 감싼다.
 */

const STAGES: { value: RoadmapStage; label: string }[] = [
  { value: "exploration", label: "탐색" },
  { value: "planning", label: "계획" },
  { value: "training", label: "훈련" },
  { value: "employment", label: "취업/자립" },
];

export function RoadmapProgress({
  stage,
  onChange,
}: {
  stage: RoadmapStage;
  onChange?: (s: RoadmapStage) => void;
}) {
  const currentIdx = STAGES.findIndex((s) => s.value === stage);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole={onChange ? undefined : "text"}
    >
      {STAGES.map((s, idx) => {
        const isCurrent = s.value === stage;
        const isDone = idx < currentIdx;
        const interactive = Boolean(onChange);

        const node = (
          <View style={styles.stageCol}>
            <Text
              style={styles.marker}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {isCurrent ? "●" : " "}
            </Text>
            <View
              style={[
                styles.dot,
                isDone && styles.dotDone,
                isCurrent && styles.dotCurrent,
              ]}
            >
              <Text style={[styles.dotText, (isDone || isCurrent) && styles.dotTextOn]}>
                {idx + 1}
              </Text>
            </View>
            <Text style={[styles.label, isCurrent && styles.labelCurrent]}>{s.label}</Text>
          </View>
        );

        return (
          <View key={s.value} style={styles.seg}>
            {interactive ? (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: isCurrent, checked: isCurrent }}
                accessibilityLabel={`${s.label} 단계${isCurrent ? ", 현재 선택됨" : ""}`}
                onPress={() => onChange?.(s.value)}
                style={({ pressed }) => [styles.touch, pressed && styles.pressed]}
              >
                {node}
              </Pressable>
            ) : (
              node
            )}
            {idx < STAGES.length - 1 ? (
              <Text
                style={[styles.arrow, idx < currentIdx && styles.arrowDone]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                ›
              </Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: SPACING.sm, gap: 2 },
  seg: { flexDirection: "row", alignItems: "center" },
  touch: { minHeight: TOUCH_MIN, justifyContent: "center", borderRadius: RADIUS.md },
  pressed: { opacity: 0.85 },
  stageCol: { alignItems: "center", width: 72, gap: 2 },
  marker: { fontSize: 12, height: 16, color: PRIMARY[600], fontWeight: "800" },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NEUTRAL.surface,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: PRIMARY[400], borderColor: PRIMARY[400] },
  dotCurrent: { backgroundColor: PRIMARY[600], borderColor: PRIMARY[700] },
  dotText: { fontSize: 15, fontWeight: "800", color: NEUTRAL.textMuted },
  dotTextOn: { color: "#fff" },
  label: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textMuted, textAlign: "center" },
  labelCurrent: { color: PRIMARY[700] },
  arrow: { fontSize: 22, fontWeight: "800", color: NEUTRAL.border, marginTop: 20, marginHorizontal: 2 },
  arrowDone: { color: PRIMARY[400] },
});
