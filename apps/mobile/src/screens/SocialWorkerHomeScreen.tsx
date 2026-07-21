import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import {
  getSocialWorkerClients,
  getServiceUsageNextReviewDates,
  type SocialWorkerClient,
} from "../lib/isp";
import { getTransitionPlanClients, type TransitionClient } from "../lib/transition";
import { getLegClients, type LegClient } from "../lib/leg";
import { koreanAge } from "../lib/date";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { NotificationBell } from "../components/NotificationBell";
import { WeeklyTaskCard } from "../components/records/WeeklyTaskCard";
import { ddayFrom, isWithinWeek, sortWeeklyTasks, type WeeklyTaskItem } from "../lib/weekly-tasks";
import { DOMAIN_COLORS, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "SocialWorkerHome">;

/** 재사정 D-day가 0~30이면 D-30 경고 배지 노출(사용자 명시 요구사항). */
function isReassessmentSoon(dday: number | null): boolean {
  return dday != null && dday >= 0 && dday <= 30;
}

/**
 * W-01 홈 — 요약 통계, 담당 당사자 카드 목록. 카드 탭 시 ISP 점검 또는 새 ISP 작성으로 이동.
 * "이번 주 처리할 일"(docs/14 Wave W-4)은 ISP·WEL-005·TRA-001·LEG-001 4종 마감일을
 * 통합한다(웹 동형) — 기존 TodayTasks(ISP만)를 이 카드로 완전히 대체했다.
 */
export function SocialWorkerHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [clients, setClients] = useState<SocialWorkerClient[]>([]);
  const [serviceUsageReviews, setServiceUsageReviews] = useState<
    { personId: string; personName: string; nextReviewDate: string }[]
  >([]);
  const [transitionClients, setTransitionClients] = useState<TransitionClient[]>([]);
  const [legClients, setLegClients] = useState<LegClient[]>([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};
    setName((meta.full_name as string) || (meta.name as string) || "");
    // 성인기 당사자는 성인 서비스 전환 검토 대상이라 목록 최상단으로 끌어올린다(안정 정렬).
    const [list, serviceUsageRes, transitionRes, legRes] = await Promise.all([
      getSocialWorkerClients(),
      getServiceUsageNextReviewDates(),
      getTransitionPlanClients(),
      getLegClients(),
    ]);
    const sorted = list
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const aAdult = a.c.lifeStage === "adult" ? 0 : 1;
        const bAdult = b.c.lifeStage === "adult" ? 0 : 1;
        return aAdult - bAdult || a.i - b.i;
      })
      .map((x) => x.c);
    setClients(sorted);
    setServiceUsageReviews(serviceUsageRes);
    setTransitionClients(transitionRes);
    setLegClients(legRes);
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

  const withIspCount = clients.filter((c) => c.latestIspRecordId).length;
  const reassessSoonCount = clients.filter((c) => isReassessmentSoon(c.reassessmentDday)).length;

  const weeklyTasks = sortWeeklyTasks([
    ...clients.flatMap((c): WeeklyTaskItem[] => {
      if (c.reassessmentDday == null || !isWithinWeek(c.reassessmentDday)) return [];
      return [
        {
          personId: c.personId,
          personName: c.fullName,
          recordType: "WEL-004",
          label: "ISP 재사정",
          dday: c.reassessmentDday,
          onPress: () => navigation.navigate("IspWizard", { personId: c.personId, personName: c.fullName }),
        },
      ];
    }),
    ...serviceUsageReviews.flatMap((r): WeeklyTaskItem[] => {
      const dday = ddayFrom(r.nextReviewDate);
      if (dday == null || !isWithinWeek(dday)) return [];
      return [
        {
          personId: r.personId,
          personName: r.personName,
          recordType: "WEL-005",
          label: "서비스 이용현황 재검토",
          dday,
          onPress: () => navigation.navigate("ServiceUsage"),
        },
      ];
    }),
    ...transitionClients.flatMap((c): WeeklyTaskItem[] => {
      const dday = ddayFrom(c.latestPlan?.nextReviewDate);
      if (dday == null || !isWithinWeek(dday)) return [];
      return [
        {
          personId: c.personId,
          personName: c.fullName,
          recordType: "TRA-001",
          label: "전환계획 재검토",
          dday,
          onPress: () =>
            navigation.navigate("TransitionPlanWizard", { personId: c.personId, personName: c.fullName }),
        },
      ];
    }),
    ...legClients.flatMap((c): WeeklyTaskItem[] => {
      const dday = ddayFrom(c.latestReportDue);
      if (dday == null || !isWithinWeek(dday)) return [];
      return [
        {
          personId: c.personId,
          personName: c.fullName,
          recordType: "LEG-001",
          label: "후견감독보고서 제출기한",
          dday,
          onPress: () =>
            navigation.navigate("GuardianshipReportWizard", { personId: c.personId, personName: c.fullName }),
        },
      ];
    }),
  ]);

  const openClient = (c: SocialWorkerClient) => {
    if (c.latestIspRecordId) {
      navigation.navigate("IspReview", { recordId: c.latestIspRecordId });
    } else {
      navigation.navigate("IspWizard", { personId: c.personId, personName: c.fullName });
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
          <Text style={styles.subtle}>담당 당사자 현황을 확인하세요.</Text>
        </View>
        <View style={styles.topActions}>
          <NotificationBell onPress={() => navigation.navigate("Notifications")} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat n={clients.length} label="담당 당사자" />
        <Stat n={withIspCount} label="ISP 수립" />
        <Stat n={reassessSoonCount} label="재사정 임박" />
      </View>

      <View style={styles.newRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 ISP 작성"
          onPress={() => navigation.navigate("IspWizard", { personId: "", personName: "" })}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <Text style={styles.newBtnText}>＋ 새 ISP 작성</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="서비스 이용 현황"
          onPress={() => navigation.navigate("ServiceUsage")}
          style={({ pressed }) => [styles.svcBtn, pressed && styles.pressed]}
        >
          <Text style={styles.svcBtnText}>서비스 현황</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="전환계획 작성"
        onPress={() => navigation.navigate("TransitionPlanWizard", { personId: "", personName: "" })}
        style={({ pressed }) => [styles.transitionBtn, pressed && styles.pressed]}
      >
        <Text style={styles.transitionBtnText}>🌱 전환계획 작성 (만 13세+)</Text>
      </Pressable>

      <View style={styles.newRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="사례회의록 작성"
          onPress={() => navigation.navigate("CaseConferenceForm")}
          style={({ pressed }) => [styles.altBtn, pressed && styles.pressed]}
        >
          <Text style={styles.altBtnText}>📝 사례회의록</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="법률·권리 기록"
          onPress={() => navigation.navigate("LegBoard")}
          style={({ pressed }) => [styles.altBtn, pressed && styles.pressed]}
        >
          <Text style={styles.altBtnText}>⚖️ 법률·권리 기록</Text>
        </Pressable>
      </View>

      {/* docs/13 Wave Q-6: 웹 사이드바엔 "인계인수"가 있는데 모바일엔 진입점 자체가
          없었다(HandoverList/Compose 라우트가 SocialWorkerStack에 등록조차 안 돼 있었음). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="인계인수"
        onPress={() => navigation.navigate("HandoverList")}
        style={({ pressed }) => [styles.altBtn, styles.handoverBtn, pressed && styles.pressed]}
      >
        <Text style={styles.altBtnText}>🔁 인계인수</Text>
      </Pressable>

      <WeeklyTaskCard items={weeklyTasks} />

      <Text style={styles.sectionTitle}>담당 당사자</Text>
      {clients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>담당 당사자가 없습니다.</Text>
          <Text style={styles.emptyHint}>
            보호자가 복지 도메인 권한을 부여하면 여기에 당사자가 표시됩니다.
          </Text>
        </View>
      ) : (
        clients.map((c) => {
          const age = koreanAge(c.birthDate);
          const hasIsp = Boolean(c.latestIspRecordId);
          const soon = isReassessmentSoon(c.reassessmentDday);
          const isAdult = c.lifeStage === "adult";
          return (
            <Pressable
              key={c.personId}
              accessibilityRole="button"
              accessibilityLabel={`${c.fullName}${age != null ? ` 만 ${age}세` : ""}${
                isAdult ? ", 성인 서비스 전환 필요" : ""
              }${soon ? `, 재사정 D-${c.reassessmentDday}` : ""}, ${
                hasIsp ? "ISP 점검하기" : "새 ISP 작성하기"
              }`}
              onPress={() => openClient(c)}
              style={({ pressed }) => [styles.stuCard, pressed && styles.pressed]}
            >
              <View style={styles.stuTop}>
                <Text style={styles.avatar}>🧑</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.stuName}>{c.fullName}</Text>
                  <View style={styles.metaRow}>
                    <StageBadge lifeStage={c.lifeStage} />
                    {age != null ? <Text style={styles.stuMeta}>만 {age}세</Text> : null}
                  </View>
                </View>
                {soon ? (
                  <Text style={styles.warnTag}>재사정 D-{c.reassessmentDday}</Text>
                ) : null}
              </View>

              {isAdult ? (
                <Text style={styles.adultTag} accessibilityElementsHidden importantForAccessibility="no">
                  성인 서비스 전환 필요
                </Text>
              ) : null}

              {hasIsp ? (
                <View style={styles.stuStats}>
                  <View style={styles.stuStat}>
                    <Text style={styles.stuStatN}>{c.ispGoalCount}</Text>
                    <Text style={styles.stuStatL}>ISP 목표</Text>
                  </View>
                  <View style={styles.stuStat}>
                    <Text style={styles.stuStatN}>
                      {c.ispAchievementAvg != null ? `${c.ispAchievementAvg}%` : "-"}
                    </Text>
                    <Text style={styles.stuStatL}>달성률</Text>
                  </View>
                  <Text style={styles.cta}>ISP 점검 ›</Text>
                </View>
              ) : (
                <View style={styles.newIspRow}>
                  <Text style={styles.newIspText}>＋ 새 ISP 작성</Text>
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
  topActions: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
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
  svcBtn: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    backgroundColor: PRIMARY[50],
  },
  svcBtnText: { fontSize: 15, fontWeight: "700", color: PRIMARY[700] },
  transitionBtn: {
    marginTop: SPACING.sm,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    borderStyle: "dashed",
    backgroundColor: PRIMARY[50],
  },
  transitionBtnText: { fontSize: 15, fontWeight: "700", color: PRIMARY[700] },
  altBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    backgroundColor: PRIMARY[50],
  },
  altBtnText: { fontSize: 14, fontWeight: "700", color: PRIMARY[700] },
  handoverBtn: { marginTop: SPACING.sm },
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
  adultTag: {
    alignSelf: "flex-start",
    marginTop: SPACING.sm,
    fontSize: 12,
    fontWeight: "700",
    color: DOMAIN_COLORS.DAI.text,
    backgroundColor: DOMAIN_COLORS.DAI.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  warnTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B56F10",
    backgroundColor: "#FFF5E6",
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
  newIspRow: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
  },
  newIspText: { fontSize: 15, fontWeight: "700", color: PRIMARY[700] },
});
