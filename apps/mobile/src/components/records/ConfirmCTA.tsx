import { Pressable, StyleSheet, Text } from "react-native";
import { PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../../theme/colors";

/**
 * docs/03-uiux.md §6-7 기록 확인(Confirmation) CTA(모바일) — 웹 ConfirmCTA와 동일 개념.
 * "확인"만 남기는 버튼이다. 승인/반려/거부 같은 대체 동작은 제공하지 않는다.
 */
export interface ConfirmCTAProps {
  onConfirm: () => void;
  busy?: boolean;
  /** 기본 "확인했습니다". 당사자 본인 화면 등에서 "이 기록을 봤어요"로 바꿔 쓴다. */
  label?: string;
}

export function ConfirmCTA({ onConfirm, busy, label = "확인했습니다" }: ConfirmCTAProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy }}
      onPress={onConfirm}
      disabled={busy}
      style={({ pressed }) => [styles.btn, pressed && !busy && styles.pressed]}
    >
      <Text style={styles.btnText}>{busy ? "처리 중..." : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: SPACING.md,
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  btnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  pressed: { opacity: 0.85 },
});
