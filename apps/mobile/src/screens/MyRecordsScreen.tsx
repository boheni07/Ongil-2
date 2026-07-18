import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getMyPersonProfile } from "../lib/person";
import { confirmRecord, getPersonRecords, type RecordListItem } from "../lib/records";
import { computeLifeStage, isSelfConfirmingStage } from "../lib/iep";
import { DomainChip } from "../components/DomainChip";
import { ConfirmBadge } from "../components/records/ConfirmBadge";
import { ConfirmCTA } from "../components/records/ConfirmCTA";
import { ErrorBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { PersonStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<PersonStackParamList, "MyRecords">;

/**
 * P-10 내 기록 보기 — 당사자 본인의 records를 나열(RLS가 본인 것만 반환).
 * "이 기록을 봤어요" 확인 CTA는 §3-10에 따라 성인기·노년기(만 19세 이상)이고,
 * 해당 기록의 확인 주체가 본인이며 아직 미확인일 때만 노출한다. 미성년이면 배지만 표시.
 */
export function MyRecordsScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecordListItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdult, setIsAdult] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);
    const profile = await getMyPersonProfile();
    setIsAdult(profile ? isSelfConfirmingStage(computeLifeStage(profile.birthDate)) : false);
    setItems(await getPersonRecords(user.id));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleConfirm(id: string) {
    setBusyId(id);
    setError(null);
    const res = await confirmRecord(id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, confirmedAt: new Date().toISOString() } : r))
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>내 기록</Text>
        <Text style={styles.subtle}>
          나에 대한 기록을 볼 수 있어요.{isAdult ? " 확인이 필요한 기록은 직접 확인해 주세요." : ""}
        </Text>
        {error ? <ErrorBanner message={error} /> : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>아직 기록이 없어요.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const canConfirm =
            isAdult &&
            item.requiresConfirmation &&
            !item.confirmedAt &&
            item.confirmerId === userId;
          return (
            <View style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <DomainChip domain={item.domain} />
              </View>
              <Text style={styles.rowMeta}>
                {item.authorName ?? "알 수 없음"} · {item.recordDate.slice(0, 10)}
              </Text>
              {item.requiresConfirmation && (
                <View style={styles.badgeRow}>
                  <ConfirmBadge confirmedAt={item.confirmedAt} />
                </View>
              )}
              {canConfirm && (
                <ConfirmCTA
                  onConfirm={() => void handleConfirm(item.id)}
                  busy={busyId === item.id}
                  label="이 기록을 봤어요"
                />
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  header: { padding: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
  title: { fontSize: FONT.h1, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: 16, color: NEUTRAL.textMuted, lineHeight: 24 },
  listContent: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  emptyBox: { padding: SPACING.xl, alignItems: "center" },
  emptyText: { fontSize: 18, color: NEUTRAL.textMuted },
  row: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
    gap: SPACING.xs,
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rowTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: NEUTRAL.text },
  rowMeta: { fontSize: 14, color: NEUTRAL.textMuted },
  badgeRow: { marginTop: 2 },
});
