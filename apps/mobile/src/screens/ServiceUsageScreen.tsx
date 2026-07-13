import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getServiceUsage, type ServiceUsageRow } from "../lib/isp";
import { DomainChip } from "../components/DomainChip";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "ServiceUsage">;

type StatusFilter = "all" | "active" | "paused" | "ended";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "active", label: "이용중" },
  { key: "paused", label: "대기" },
  { key: "ended", label: "종료" },
];

const STATUS_META: Record<
  ServiceUsageRow["status"],
  { label: string; bg: string; color: string }
> = {
  active: { label: "이용중", bg: PRIMARY[50], color: PRIMARY[700] },
  paused: { label: "대기", bg: "#FFF5E6", color: "#B56F10" },
  ended: { label: "종료", bg: NEUTRAL.surface, color: NEUTRAL.textMuted },
};

/** W-17 서비스 이용 현황 — 상태 필터(전체/이용중/대기/종료) + 목록. */
export function ServiceUsageScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ServiceUsageRow[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      const data = await getServiceUsage(filter === "all" ? undefined : { status: filter });
      if (alive) {
        setRows(data);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filter]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <Text style={styles.title}>서비스 이용 현황</Text>
      <Text style={styles.sub}>담당 당사자별 복지 서비스 이용 및 연계 상태</Text>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => {
          const sel = filter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${f.label} 필터`}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => [styles.filterChip, sel && styles.filterChipSel, pressed && styles.pressed]}
            >
              <Text style={[styles.filterText, sel && styles.filterTextSel]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY[600]} style={{ marginTop: SPACING.xl }} />
      ) : rows.length === 0 ? (
        <Text style={styles.muted}>해당 조건의 서비스가 없습니다.</Text>
      ) : (
        rows.map((r, i) => {
          const meta = STATUS_META[r.status];
          return (
            <View key={`${r.personId}-${r.serviceName}-${i}`} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.svcName}>{r.serviceName || "서비스명 미상"}</Text>
                  <Text style={styles.person}>{r.personName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <DomainChip domain={r.domain} />
                {r.provider ? <Text style={styles.metaText}>{r.provider}</Text> : null}
                <Text style={styles.metaText}>{r.period}</Text>
              </View>
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
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.lg, marginBottom: SPACING.md },
  filterChip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  filterChipSel: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  filterText: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text },
  filterTextSel: { color: PRIMARY[800] },
  pressed: { opacity: 0.85 },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: SPACING.lg },
  card: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md },
  svcName: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text },
  person: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  metaText: { fontSize: 13, color: NEUTRAL.textMuted },
});
