import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCaseNoteClients,
  listCaseNotes,
  type CaseNoteClient,
  type CaseNoteSummary,
} from "../lib/case-notes";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "CaseNotesList">;

/**
 * W-22 사례회의록(WEL-006) 목록 — 웹 CaseNotesBoard 이식. LegBoardScreen과 동일 구조.
 * 상단에 새 회의록 작성 진입 버튼, 하단에 담당 당사자별 사례회의록 목록(카드 탭 시 펼침).
 * 확인 절차가 없는 일상 기록이라 확인 배지를 쓰지 않는다. 작성 진입은 폼 안에서 당사자를 고른다.
 */
export function CaseNotesListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<CaseNoteClient[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, CaseNoteSummary[]>>({});

  const load = useCallback(async () => {
    setClients(await getCaseNoteClients());
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
    if (!notes[personId]) {
      const rows = await listCaseNotes(personId);
      setNotes((prev) => ({ ...prev, [personId]: rows }));
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
      <Text style={styles.title}>사례회의록</Text>
      <Text style={styles.sub}>ISP 수립·재사정 논의 내용과 결정사항을 기록하고 관리합니다.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="새 사례회의록 작성"
        onPress={() => navigation.navigate("CaseConferenceForm")}
        style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
      >
        <Text style={styles.newBtnText}>＋ 사례회의록 작성</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>담당 당사자별 기록</Text>
      {clients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>담당 당사자가 없습니다.</Text>
          <Text style={styles.emptyHint}>
            보호자가 복지서비스(WEL) 도메인 작성 권한을 부여하면 여기에 당사자가 표시됩니다.
          </Text>
        </View>
      ) : (
        clients.map((c) => {
          const isOpen = expanded === c.personId;
          const rows = notes[c.personId] ?? null;
          return (
            <View key={c.personId} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${c.fullName}, 사례회의록 ${c.caseNoteCount}건, ${
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
                    <Text style={styles.meta}>기록 {c.caseNoteCount}건</Text>
                  </View>
                </View>
                <Text style={styles.chevron}>{isOpen ? "▾" : "▸"}</Text>
              </Pressable>

              {isOpen ? (
                <View style={styles.recordList}>
                  {rows === null ? (
                    <ActivityIndicator color={PRIMARY[600]} style={{ marginVertical: SPACING.md }} />
                  ) : rows.length === 0 ? (
                    <Text style={styles.emptyRecord}>작성된 사례회의록이 없습니다.</Text>
                  ) : (
                    rows.map((r) => (
                      <View key={r.recordId} style={styles.recordRow}>
                        <View style={styles.recordTop}>
                          <Text style={styles.recordDate}>{r.meetingDate.slice(0, 10)} 회의</Text>
                          {r.participants.length > 0 ? (
                            <Text style={styles.participants} numberOfLines={1}>
                              참석: {r.participants.join(", ")}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.discussion}>{r.discussion}</Text>
                        {r.decisions ? (
                          <Text style={styles.decisions}>
                            <Text style={styles.decisionsLabel}>결정사항 </Text>
                            {r.decisions}
                          </Text>
                        ) : null}
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
  newBtn: {
    marginTop: SPACING.lg,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
  },
  newBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
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
  recordDate: { fontSize: 14, fontWeight: "700", color: NEUTRAL.text },
  participants: { flex: 1, fontSize: 12, color: NEUTRAL.textMuted },
  discussion: { fontSize: 14, color: NEUTRAL.text, lineHeight: 20 },
  decisions: { fontSize: 12, color: NEUTRAL.textMuted, lineHeight: 18 },
  decisionsLabel: { fontWeight: "700", color: PRIMARY[700] },
});
