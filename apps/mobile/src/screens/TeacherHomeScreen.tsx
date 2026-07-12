import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getTeacherStudents, type TeacherStudent, type LifeStage } from "../lib/iep";
import { koreanAge } from "../lib/date";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TeacherStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TeacherStackParamList, "TeacherHome">;

const STAGE_LABEL: Record<LifeStage, string> = {
  child: "아동기",
  youth_transition: "청소년 전환기",
  adult: "성년기",
};

/** T-01 홈 — 요약 통계, 담당 학생 카드 목록. 카드 탭 시 IEP 점검 또는 새 IEP 작성으로 이동. */
export function TeacherHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [students, setStudents] = useState<TeacherStudent[]>([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};
    setName((meta.full_name as string) || (meta.name as string) || "");
    setStudents(await getTeacherStudents());
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

  const transitionCount = students.filter((s) => s.lifeStage !== "child").length;
  const withIepCount = students.filter((s) => s.latestIepRecordId).length;

  const openStudent = (s: TeacherStudent) => {
    if (s.latestIepRecordId) {
      navigation.navigate("IepReview", { recordId: s.latestIepRecordId });
    } else {
      navigation.navigate("IepWizard", { personId: s.personId, personName: s.fullName });
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
          <Text style={styles.subtle}>담당 학생 현황을 확인하세요.</Text>
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
        <Stat n={students.length} label="담당 학생" />
        <Stat n={withIepCount} label="IEP 수립" />
        <Stat n={transitionCount} label="전환계획 대상" />
      </View>

      <Text style={styles.sectionTitle}>담당 학생</Text>
      {students.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>담당 학생이 없습니다.</Text>
          <Text style={styles.emptyHint}>
            보호자가 교육 도메인 권한을 부여하면 여기에 학생이 표시됩니다.
          </Text>
        </View>
      ) : (
        students.map((s) => {
          const age = koreanAge(s.birthDate);
          const hasIep = Boolean(s.latestIepRecordId);
          return (
            <Pressable
              key={s.personId}
              accessibilityRole="button"
              accessibilityLabel={`${s.fullName}${age != null ? ` 만 ${age}세` : ""}, ${
                hasIep ? "IEP 점검하기" : "새 IEP 작성하기"
              }`}
              onPress={() => openStudent(s)}
              style={({ pressed }) => [styles.stuCard, pressed && styles.pressed]}
            >
              <View style={styles.stuTop}>
                <Text style={styles.avatar}>🧑‍🎓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stuName}>{s.fullName}</Text>
                  <Text style={styles.stuMeta}>
                    {STAGE_LABEL[s.lifeStage]}
                    {age != null ? ` · 만 ${age}세` : ""}
                  </Text>
                </View>
                {s.lifeStage !== "child" ? (
                  <Text style={styles.transTag}>전환</Text>
                ) : null}
              </View>

              {hasIep ? (
                <View style={styles.stuStats}>
                  <View style={styles.stuStat}>
                    <Text style={styles.stuStatN}>{s.iepGoalCount}</Text>
                    <Text style={styles.stuStatL}>IEP 목표</Text>
                  </View>
                  <View style={styles.stuStat}>
                    <Text style={styles.stuStatN}>
                      {s.iepAchievementAvg != null ? `${s.iepAchievementAvg}%` : "-"}
                    </Text>
                    <Text style={styles.stuStatL}>달성률</Text>
                  </View>
                  <Text style={styles.cta}>IEP 점검 ›</Text>
                </View>
              ) : (
                <View style={styles.newIepRow}>
                  <Text style={styles.newIepText}>＋ 새 IEP 작성</Text>
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
  stuMeta: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 2 },
  transTag: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY[700],
    backgroundColor: PRIMARY[100],
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
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
  newIepRow: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
  },
  newIepText: { fontSize: 15, fontWeight: "700", color: PRIMARY[700] },
});
