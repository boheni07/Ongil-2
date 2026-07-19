import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getSupporterJournals, type SupportJournalSummary } from "../lib/journal";
import { DOMAIN_COLORS, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";
import type { SupporterStackParamList } from "../navigation/types";

/**
 * S-13 일지 목록 탭 — app-supporter.html 하단 탭바 "일지". 기존엔 SupporterHome의 최근 일지
 * 섹션(최대 20건)뿐이었고 전용 목록 화면이 없었다(2026-07-19 프로토타입 대조로 신설).
 */
export function JournalListScreen() {
  const navigation = useNavigation<{
    navigate: (route: keyof SupporterStackParamList, params?: unknown) => void;
  }>();
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState<SupportJournalSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      void getSupporterJournals(50).then((data) => {
        if (alive) {
          setJournals(data);
          setLoading(false);
        }
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>일지</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="일지 작성"
          onPress={() => navigation.navigate("JournalCompose")}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <Text style={styles.newBtnText}>✍️ 작성</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY[600]} style={{ marginTop: SPACING.xl }} />
      ) : journals.length === 0 ? (
        <Text style={styles.empty}>아직 작성한 일지가 없습니다.</Text>
      ) : (
        <FlatList
          data={journals}
          keyExtractor={(j) => j.id}
          contentContainerStyle={{ gap: SPACING.sm, paddingTop: SPACING.md }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.personName ?? "이용자"} 일지`}
              onPress={() => navigation.navigate("JournalDetail", { journalId: item.id })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.personName ?? "이용자"} 님 활동일지</Text>
                <Text style={styles.rowMeta}>
                  {item.serviceDate ?? item.recordDate.slice(0, 10)}
                  {item.serviceHours != null ? ` · ${item.serviceHours}시간` : ""}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: item.isDraft ? DOMAIN_COLORS.DAI.bg : PRIMARY[50] },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: item.isDraft ? DOMAIN_COLORS.DAI.text : PRIMARY[700] },
                  ]}
                >
                  {item.isDraft ? "임시저장" : "제출 완료"}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEUTRAL.bg, padding: SPACING.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  newBtn: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  newBtnText: { color: "#fff", fontSize: FONT.body, fontWeight: "700" },
  empty: { marginTop: SPACING.xl, fontSize: FONT.body, color: NEUTRAL.textMuted, textAlign: "center" },
  row: {
    minHeight: TOUCH_MIN + 8,
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  pressed: { opacity: 0.7 },
  rowTitle: { fontSize: FONT.body + 1, fontWeight: "700", color: NEUTRAL.text },
  rowMeta: { fontSize: FONT.caption, color: NEUTRAL.textMuted, marginTop: 2 },
  badge: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  badgeText: { fontSize: FONT.caption, fontWeight: "700" },
});
