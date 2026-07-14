import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPersonRecords, type RecordListItem } from "../lib/records";
import { DomainChip } from "../components/DomainChip";
import { ConfirmBadge } from "../components/records/ConfirmBadge";
import { FONT, NEUTRAL, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "RecordManager">;

/**
 * G-20 기록 관리(모바일) — 검색 + 목록. 항목 탭 시 RecordDetail로 이동.
 * 프로토타입 web-guardian.html 455~523줄을 모바일 목록→상세 전환 관례로 옮겼다.
 */
export function RecordManagerScreen({ route, navigation }: Props) {
  const { personId, personName } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecordListItem[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setItems(await getPersonRecords(personId));
    setLoading(false);
  }, [personId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.authorName?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  return (
    <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>기록 관리</Text>
        <Text style={styles.subtle}>{personName} · 보호자는 모든 도메인의 기록을 직접 작성·수정할 수 있습니다.</Text>
        <TextInput
          accessibilityLabel="기록 검색"
          placeholder="🔍 기록 검색 (제목·작성자)"
          placeholderTextColor={NEUTRAL.textMuted}
          value={query}
          onChangeText={setQuery}
          style={styles.search}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 기록 작성"
          onPress={() => navigation.navigate("RecordForm", { personId, personName })}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
        >
          <Text style={styles.newBtnText}>＋ 새 기록 작성</Text>
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>기록이 없습니다.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title} 상세 보기`}
            onPress={() => navigation.navigate("RecordDetail", { recordId: item.id, personId, personName })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowHead}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <DomainChip domain={item.domain} />
            </View>
            <View style={styles.rowMetaRow}>
              <Text style={styles.rowMeta}>
                {item.authorName ?? "알 수 없음"} · {item.recordDate.slice(0, 10)}
              </Text>
              {item.isDraft && (
                <View style={styles.draftBadge}>
                  <Text style={styles.draftText}>임시저장</Text>
                </View>
              )}
              {item.requiresConfirmation && <ConfirmBadge confirmedAt={item.confirmedAt} />}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  header: { padding: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  search: {
    minHeight: TOUCH_MIN,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.body,
    color: NEUTRAL.text,
    backgroundColor: "#fff",
    marginTop: SPACING.xs,
  },
  newBtn: {
    marginTop: SPACING.xs,
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS.md,
    backgroundColor: "#FAC775",
    alignItems: "center",
    justifyContent: "center",
  },
  newBtnText: { fontSize: 15, fontWeight: "800", color: "#1A1C1A" },
  pressed: { opacity: 0.85 },
  listContent: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  emptyBox: { padding: SPACING.xl, alignItems: "center" },
  emptyText: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  row: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
    gap: 4,
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: NEUTRAL.text },
  rowMetaRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  rowMeta: { fontSize: FONT.caption, color: NEUTRAL.textMuted },
  draftBadge: { backgroundColor: "#FFF5E6", borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  draftText: { fontSize: 11, fontWeight: "700", color: "#B56F10" },
});
