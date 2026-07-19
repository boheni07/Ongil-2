import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";

/**
 * app-{teacher,social-worker,therapist,supporter,guardian}.html 설정 탭 공용 구현.
 * 기존엔 각 Home 화면 우상단의 인라인 "로그아웃" 텍스트가 유일한 출구였다 — 프로토타입은
 * 전용 설정 화면(프로필/알림/담당관리/개인정보·동의/도움말/로그아웃)을 전제하므로 신설한다
 * (2026-07-19). 개인정보·동의는 이미 있는 PrivacySettingsScreen으로 위임한다.
 * 사용자 이름은 자체 조회한다(Home 탭과 별개 인스턴스라 props로 이어받지 않는다).
 */
export function RoleSettingsScreen({
  roleLabel,
  manageLabel,
}: {
  roleLabel: string;
  manageLabel?: string;
}) {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  const [userName, setUserName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void supabase.auth.getUser().then(({ data: { user } }) => {
        const meta = user?.user_metadata ?? {};
        setUserName((meta.full_name as string) || (meta.name as string) || null);
      });
    }, [])
  );

  const confirmLogout = () => {
    Alert.alert("로그아웃", "정말 로그아웃하시겠어요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => void supabase.auth.signOut() },
    ]);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>설정</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(userName ?? roleLabel).slice(0, 1)}</Text>
        </View>
        <View>
          <Text style={styles.profileName}>{userName ?? roleLabel}</Text>
          <Text style={styles.profileRole}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        {manageLabel ? <MenuRow label={manageLabel} onPress={() => navigation.navigate("Home")} /> : null}
        <MenuRow label="알림" onPress={() => navigation.navigate("Notifications")} />
        <MenuRow
          label="개인정보·동의 관리"
          onPress={() => navigation.navigate("PrivacySettings")}
        />
        <MenuRow label="도움말" onPress={() => Alert.alert("도움말", "준비 중입니다.")} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="로그아웃"
        onPress={confirmLogout}
        style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
      >
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
    >
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEUTRAL.bg, padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text, marginBottom: SPACING.lg },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: FONT.h3, fontWeight: "800" },
  profileName: { fontSize: FONT.h3, fontWeight: "800", color: NEUTRAL.text },
  profileRole: { fontSize: FONT.caption, color: NEUTRAL.textMuted, marginTop: 2 },
  menu: { gap: SPACING.sm },
  menuRow: {
    minHeight: TOUCH_MIN + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  menuLabel: { fontSize: FONT.body + 1, fontWeight: "600", color: NEUTRAL.text },
  chevron: { fontSize: 20, color: NEUTRAL.textMuted },
  pressed: { opacity: 0.7 },
  logoutBtn: {
    marginTop: SPACING.xl,
    minHeight: TOUCH_MIN + 4,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: NEUTRAL.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: NEUTRAL.danger, fontSize: FONT.body + 1, fontWeight: "700" },
});
