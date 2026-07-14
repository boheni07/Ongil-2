import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getTherapistClients, type TherapistClient } from "../lib/therapy";
import { koreanAge } from "../lib/date";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TherapistStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TherapistStackParamList, "TherapistHome">;

/** TH-01 홈 — 요약 통계, 담당 아동 카드 목록. 카드 탭 시 계획서 상세 또는 새 계획서 작성으로 이동. */
export function TherapistHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [clients, setClients] = useState<TherapistClient[]>([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};
    setName((meta.full_name as string) || (meta.name as string) || "");
    setClients(await getTherapistClients());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} />
      </View>
    );
  }

  const withPlanCount = clients.filter((c) => c.latestPlanRecordId).length;
  const totalSessions = clients.reduce((sum, c) => sum + c.sessionCount, 0);

  const openClient = (c: TherapistClient) => {
    if (c.latestPlanRecordId) {
      navigation.navigate("TherapyPlanDetail", { recordId: c.latestPlanRecordId });
    } else {
      navigation.navigate("TherapyPlanWizard", { personId: c.personId, personName: c.fullName });
    }
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>안녕하세요{name ? `, ${name} 선생님` : ""}</Text>
          <Text style={styles.subtle}>담당 아동의 치료 현황을 확인하세요.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          onPress={() => supabase.auth.signOut()}
          hitSlop={8}
        >
          <Text style={styles.logout}>로그아웃</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <Stat n={clients.length} label="담당 아동" />
        <Stat n={withPlanCount} label="계획서 수립" />
        <Stat n={totalSessions} label="누적 회기" />
      </View>

      <View style={styles.newRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="회기 일지 작성"
          onPress={() => navigation.navigate("SessionNoteForm", { personId: "", personName: "" })}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <Text style={styles.newBtnText}>＋ 회기 일지 작성</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="평가보고서 작성"
          onPress={() => navigation.navigate("EvalReport", { personId: "", personName: "" })}
          style={({ pressed }) => [styles.newBtn, styles.newBtnAlt, pressed && styles.pressed]}
        >
          <Text style={[styles.newBtnText, styles.newBtnAltText]}>＋ 평가보고서</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>담당 아동</Text>
      {clients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>담당 아동이 없습니다.</Text>
          <Text style={styles.emptyHint}>
            보호자가 의료 도메인 권한을 부여하면 여기에 아동이 표시됩니다.
          </Text>
        </View>
      ) : (
        clients.map((c) => {
          const age = koreanAge(c.birthDate);
          const hasPlan = Boolean(c.latestPlanRecordId);
          return (
            <Pressable
              key={c.personId}
              accessibilityRole="button"
              accessibilityLabel={`${c.fullName}${age != null ? ` 만 ${age}세` : ""}, ${
                hasPlan ? "치료계획서 보기" : "새 치료계획서 작성하기"
              }`}
              onPress={() => openClient(c)}
              style={({ pressed }) => [styles.stuCard, pressed && styles.pressed]}
            >
              <View style={styles.stuTop}>
                <Text style={styles.avatar}>🧒</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.stuName}>{c.fullName}</Text>
                  <View style={styles.metaRow}>
                    <StageBadge lifeStage={c.lifeStage} />
                    {age != null ? <Text style={styles.stuMeta}>만 {age}세</Text> : null}
                  </View>
                </View>
              </View>

              {hasPlan ? (
                <View style={styles.stuStats}>
                  <View style={styles.stuStat}>
                    <Text style={styles.stuStatN}>{c.planGoalCount}</Text>
                    <Text style={styles.stuStatL}>치료 목표</Text>
                  </View>
                  <View style={styles.stuStat}>
                    <Text style={styles.stuStatN}>{c.sessionCount}</Text>
                    <Text style={styles.stuStatL}>진행 회기</Text>
                  </View>
                  <Text style={styles.cta}>계획서 보기 ›</Text>
                </View>
              ) : (
                <View style={styles.newIspRow}>
                  <Text style={styles.newIspText}>＋ 새 치료계획서 작성</Text>
                </View>
              )}
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  topRow: { flexDirection: "row", alignItems: "flex-start" },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  logout: { fontSize: 14, fontWeight: "600", color: PRIMARY[600] },
  statsRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.surface,
  },
  statN: { fontSize: 24, fontWeight: "800", color: PRIMARY[700] },
  statL: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: 2 },
  newRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  newBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
  },
  newBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  newBtnAlt: { backgroundColor: NEUTRAL.bg, borderWidth: 1.5, borderColor: PRIMARY[600] },
  newBtnAltText: { color: PRIMARY[700] },
  sectionTitle: {
    fontSize: FONT.h3,
    fontWeight: "700",
    color: NEUTRAL.text,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  emptyBox: {
    padding: SPACING.xl,
    alignItems: "center",
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.md,
  },
  emptyText: { fontSize: FONT.body, fontWeight: "700", color: NEUTRAL.text },
  emptyHint: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 6, textAlign: "center" },
  stuCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  pressed: { opacity: 0.85 },
  stuTop: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  avatar: { fontSize: 34 },
  stuName: { fontSize: 17, fontWeight: "800", color: NEUTRAL.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  stuMeta: { fontSize: 13, color: NEUTRAL.textMuted },
  stuStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
  },
  stuStat: { alignItems: "center" },
  stuStatN: { fontSize: 18, fontWeight: "800", color: NEUTRAL.text },
  stuStatL: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 2 },
  cta: { flex: 1, textAlign: "right", fontSize: 14, fontWeight: "700", color: PRIMARY[700] },
  newIspRow: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
  },
  newIspText: { fontSize: 15, fontWeight: "700", color: PRIMARY[700] },
});
