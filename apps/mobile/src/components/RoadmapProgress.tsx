import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RoadmapStage } from "@ongil/validation";
import { DOMAIN_COLORS, NEUTRAL, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";

/**
 * W-16 전환 로드맵 시각화 — 프로토타입 app-social-worker.html/web-social-worker.html 대조로
 * 원형 이모지 노드(🔍📋🎓💼)+캡션+"● 현재 위치" 배지를 반영했다(2026-07-19, 이전엔 번호
 * 숫자 원+라벨뿐이었다 — 웹 RoadmapProgress.tsx와 동일한 결정).
 * onChange가 있으면 각 단계가 선택 입력(터치 영역 44px+)으로, 없으면 읽기 전용으로 동작한다.
 * 모바일 화면 폭을 넘칠 수 있어 가로 스크롤로 감싼다.
 */

const TRA = DOMAIN_COLORS.TRA;

const STAGES: { value: RoadmapStage; label: string; icon: string; caption: string }[] = [
  { value: "exploration", label: "탐색", icon: "🔍", caption: "직업 흥미·적성 파악" },
  { value: "planning", label: "계획", icon: "📋", caption: "전환목표 수립" },
  { value: "training", label: "훈련", icon: "🎓", caption: "직무·자립 훈련" },
  { value: "employment", label: "취업/자립", icon: "💼", caption: "고용·지역사회 정착" },
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
            <View
              style={[
                styles.dot,
                isDone && styles.dotDone,
                isCurrent && styles.dotCurrent,
              ]}
            >
              <Text style={styles.dotIcon}>{s.icon}</Text>
            </View>
            <Text style={[styles.label, isCurrent && styles.labelCurrent]}>{s.label}</Text>
            <Text style={styles.caption}>{s.caption}</Text>
            {isCurrent ? (
              <View style={styles.nowBadge}>
                <Text style={styles.nowBadgeText}>● 현재 위치</Text>
              </View>
            ) : null}
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
              <View style={[styles.connector, idx < currentIdx && styles.connectorDone]} />
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingVertical: SPACING.sm },
  seg: { flexDirection: "row", alignItems: "flex-start" },
  touch: { minHeight: TOUCH_MIN, justifyContent: "flex-start", borderRadius: RADIUS.md },
  pressed: { opacity: 0.85 },
  stageCol: { alignItems: "center", width: 92, gap: 2 },
  dot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: NEUTRAL.surface,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: TRA.accent, borderColor: TRA.accent },
  dotCurrent: { backgroundColor: "#fff", borderColor: TRA.accent },
  dotIcon: { fontSize: 20 },
  label: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textMuted, textAlign: "center", marginTop: 4 },
  labelCurrent: { color: TRA.text },
  caption: { fontSize: 11, color: NEUTRAL.textMuted, textAlign: "center" },
  nowBadge: {
    marginTop: 4,
    backgroundColor: TRA.accent,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nowBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  connector: { width: 20, height: 3, backgroundColor: NEUTRAL.border, marginTop: 23 },
  connectorDone: { backgroundColor: TRA.accent },
});
