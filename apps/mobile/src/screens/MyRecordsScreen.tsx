import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getMyPersonProfile } from "../lib/person";
import { confirmRecord, getPersonRecords, type RecordListItem } from "../lib/records";
import { computeLifeStage, isSelfConfirmingStage, type LifeStage } from "../lib/iep";
import { DomainChip } from "../components/DomainChip";
import { ConfirmBadge } from "../components/records/ConfirmBadge";
import { ConfirmCTA } from "../components/records/ConfirmCTA";
import { ErrorBanner } from "../components/ui";
import { DOMAIN_COLORS, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
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
  const [lifeStage, setLifeStage] = useState<LifeStage | null>(null);
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
    setLifeStage(profile ? computeLifeStage(profile.birthDate) : null);
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

  // Wave M-2(docs/11-livinglab-mega-workshop.md) — ITP(EDU-005)는 RLS상 이미 본인이 볼 수
  // 있지만(person 셀프 분기는 domain/record_type 무관), 다른 EDU 기록들 사이에 묻혀 청소년
  // 전환기 당사자가 놓치기 쉽다는 리빙랩 관찰에 따른 안내 배너(RLS/기능 변경 없음).
  const hasItp = lifeStage === "youth_transition" && items.some((i) => i.recordType === "EDU-005");

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
        ListHeaderComponent={
          hasItp ? (
            <View style={styles.itpBanner}>
              <Text style={styles.itpBannerIcon}>🎓</Text>
              <Text style={styles.itpBannerText}>
                학교에서 준비한 개별화전환계획(ITP)이 있어요. 아래 목록에서 확인해 보세요.
              </Text>
            </View>
          ) : null
        }
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
  itpBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: DOMAIN_COLORS.TRA.bg,
    marginBottom: SPACING.md,
  },
  itpBannerIcon: { fontSize: 28 },
  itpBannerText: { flex: 1, fontSize: 16, fontWeight: "700", color: DOMAIN_COLORS.TRA.text },
});
