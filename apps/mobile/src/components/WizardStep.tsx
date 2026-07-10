import { Pressable, StyleSheet, Text, View } from "react-native";
import { NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";

/** 당사자 모드 질문 헤더(큰 글씨). P-02 위저드용. */
export function PersonQuestion({ question, hint }: { question: string; hint?: string }) {
  return (
    <View style={styles.qWrap}>
      <Text style={styles.question}>{question}</Text>
      {hint ? <Text style={styles.qHint}>{hint}</Text> : null}
    </View>
  );
}

/** 위저드 하단 내비게이션. prev/next 기본, skip/submit는 옵션. */
export function WizardFooter({
  onPrev,
  onNext,
  onSubmit,
  onSkip,
  nextLabel = "다음",
  nextDisabled,
  loading,
  large,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  /** 당사자 모드(큰 버튼) */
  large?: boolean;
}) {
  const primary = onSubmit ?? onNext;
  return (
    <View style={styles.footer}>
      {onPrev ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전"
          onPress={onPrev}
          style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
        >
          <Text style={styles.ghostText}>이전</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {onSkip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="건너뛰기"
          onPress={onSkip}
          style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
        >
          <Text style={styles.ghostText}>건너뛰기</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={onSubmit ? "제출하기" : nextLabel}
        accessibilityState={{ disabled: nextDisabled || loading }}
        onPress={primary}
        disabled={nextDisabled || loading}
        style={({ pressed }) => [
          styles.primary,
          large && styles.primaryLarge,
          (nextDisabled || loading) && styles.primaryDisabled,
          pressed && !nextDisabled && !loading && styles.pressed,
        ]}
      >
        <Text style={[styles.primaryText, large && styles.primaryTextLarge]}>
          {loading ? "저장 중…" : onSubmit ? "제출하기" : nextLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  qWrap: { marginBottom: SPACING.xl },
  question: { fontSize: 26, fontWeight: "800", color: NEUTRAL.text, lineHeight: 34 },
  qHint: { fontSize: 18, fontWeight: "600", color: NEUTRAL.textMuted, marginTop: SPACING.sm },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xl,
  },
  spacer: { flex: 0 },
  ghost: {
    minHeight: TOUCH_MIN,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  ghostText: { fontSize: 16, fontWeight: "600", color: NEUTRAL.textMuted },
  primary: {
    flex: 1,
    minHeight: TOUCH_MIN + 4,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  primaryLarge: { minHeight: 60 },
  primaryDisabled: { backgroundColor: PRIMARY[400] },
  primaryText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  primaryTextLarge: { fontSize: 22 },
  pressed: { opacity: 0.85 },
});
