import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getLegClients,
  listLegRecords,
  type LegClient,
  type LegRecordSummary,
} from "../lib/leg";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "LegBoard">;

/**
 * W-17 법률·권리(LEG) 기록 허브 — 웹 LegRecordsBoard 이식.
 * 상단에 후견감독보고서(LEG-001)·권익옹호 상담기록(LEG-002) 작성 진입 버튼, 하단에 담당 당사자별
 * LEG 기록 목록(카드 탭 시 해당 당사자 기록 펼침). 작성 진입은 폼 안에서 당사자를 다시 고른다.
 */
export function LegBoardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<LegClient[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, LegRecordSummary[]>>({});

  const load = useCallback(async () => {
    setClients(await getLegClients());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggle = async (personId: string) => {
    if (expanded === personId) {
      setExpanded(null);
      return;
    }
    setExpanded(personId);
    if (!records[personId]) {
      const rows = await listLegRecords(personId);
      setRecords((prev) => ({ ...prev, [personId]: rows }));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <Text style={styles.title}>법률·권리 기록</Text>
      <Text style={styles.sub}>후견감독보고서·권익옹호 상담기록을 작성하고 관리합니다.</Text>

      <View style={styles.newRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="후견감독보고서 작성"
          onPress={() => navigation.navigate("GuardianshipReportWizard")}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <Text style={styles.newBtnText}>⚖️ 후견감독보고서</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="권익옹호 상담기록 작성"
          onPress={() => navigation.navigate("AdvocacyConsultationForm")}
          style={({ pressed }) => [styles.newBtn, styles.newBtnAlt, pressed && styles.pressed]}
        >
          <Text style={styles.newBtnText}>🗣️ 권익옹호 상담</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>담당 당사자별 기록</Text>
      {clients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>담당 당사자가 없습니다.</Text>
          <Text style={styles.emptyHint}>
            보호자가 법률·권리(LEG) 도메인 권한을 부여하면 여기에 당사자가 표시됩니다.
          </Text>
        </View>
      ) : (
        clients.map((c) => {
          const isOpen = expanded === c.personId;
          const rows = records[c.personId] ?? null;
          return (
            <View key={c.personId} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${c.fullName}, LEG 기록 ${c.legRecordCount}건, ${
                  isOpen ? "접기" : "펼치기"
                }`}
                onPress={() => toggle(c.personId)}
                style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]}
              >
                <Text style={styles.avatar}>🧑</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{c.fullName}</Text>
                  <View style={styles.metaRow}>
                    <StageBadge lifeStage={c.lifeStage} />
                    <Text style={styles.meta}>기록 {c.legRecordCount}건</Text>
                    {c.latestReportDue ? (
                      <Text style={styles.meta}>다음 보고 {c.latestReportDue}</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.chevron}>{isOpen ? "▾" : "▸"}</Text>
              </Pressable>

              {isOpen ? (
                <View style={styles.recordList}>
                  {rows === null ? (
                    <ActivityIndicator color={PRIMARY[600]} style={{ marginVertical: SPACING.md }} />
                  ) : rows.length === 0 ? (
                    <Text style={styles.emptyRecord}>작성된 법률·권리 기록이 없습니다.</Text>
                  ) : (
                    rows.map((r) => (
                      <View key={r.recordId} style={styles.recordRow}>
                        <View style={styles.recordTop}>
                          <Text style={styles.typeChip}>{r.recordType}</Text>
                          <Text style={styles.typeLabel}>{r.typeLabel}</Text>
                          {r.reportKind === "initial" ? (
                            <Text style={styles.initialBadge}>최초 보고</Text>
                          ) : null}
                        </View>
                        <View style={styles.recordBottom}>
                          <Text style={styles.recordDate}>{r.recordDate.slice(0, 10)}</Text>
                          {r.isDraft ? (
                            <Text style={styles.draftBadge}>임시저장</Text>
                          ) : r.requiresConfirmation ? (
                            <Text style={r.confirmedAt ? styles.confirmedBadge : styles.pendingBadge}>
                              {r.confirmedAt ? "확인 완료" : "확인 대기"}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  newRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  newBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
  },
  newBtnAlt: {
    backgroundColor: PRIMARY[50],
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
  },
  newBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  pressed: { opacity: 0.85 },
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
  card: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
    overflow: "hidden",
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md },
  avatar: { fontSize: 30 },
  name: { fontSize: 16, fontWeight: "800", color: NEUTRAL.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  meta: { fontSize: 12, color: NEUTRAL.textMuted },
  chevron: { fontSize: 18, color: PRIMARY[700], fontWeight: "700" },
  recordList: {
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  emptyRecord: { fontSize: 13, color: NEUTRAL.textMuted, textAlign: "center", paddingVertical: SPACING.sm },
  recordRow: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.surface,
    gap: 6,
  },
  recordTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  typeChip: {
    fontSize: 11,
    fontWeight: "800",
    color: PRIMARY[700],
    backgroundColor: PRIMARY[50],
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  typeLabel: { fontSize: 14, fontWeight: "700", color: NEUTRAL.text },
  initialBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B56F10",
    backgroundColor: "#FFF5E6",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  recordBottom: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  recordDate: { fontSize: 12, color: NEUTRAL.textMuted },
  draftBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: NEUTRAL.textMuted,
    backgroundColor: NEUTRAL.surface,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  pendingBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B56F10",
    backgroundColor: "#FFF5E6",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  confirmedBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY[700],
    backgroundColor: PRIMARY[50],
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
});
