import { Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";

/** 이번 범위 밖 역할(특수교사·사회복지사·치료사)의 임시 홈. */
export function GenericHomeScreen({ roleLabel }: { roleLabel: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>🚧</Text>
      <Text style={styles.title}>{roleLabel} 화면 준비 중</Text>
      <Text style={styles.desc}>이 역할의 모바일 화면은 다음 단계에서 제공됩니다.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="로그아웃"
        onPress={() => supabase.auth.signOut()}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Text style={styles.btnText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.md, backgroundColor: NEUTRAL.bg },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: "800", color: NEUTRAL.text },
  desc: { fontSize: 14, color: NEUTRAL.textMuted, textAlign: "center" },
  btn: {
    marginTop: SPACING.lg,
    minHeight: 48,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY[600],
  },
  btnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  pressed: { opacity: 0.85 },
});
