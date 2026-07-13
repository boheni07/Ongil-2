import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DomainKey } from "@ongil/validation";
import { getTimeline, type TimelineItem } from "../lib/therapy";
import { DomainChip } from "../components/DomainChip";
import { formatShortDate } from "../lib/date";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TherapistStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TherapistStackParamList, "MedTimeline">;

const DOMAIN_FILTERS: { key: DomainKey | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

/**
 * TH-20 치료 타임라인 — 스트림 뷰(시간순) + 도메인 필터. WelTimelineScreen을 의료 맥락(MED 기본,
 * TherapistStack 타입)으로 최소 복제한다. 데이터 조회(getTimeline)는 domain 무관 범용이라
 * lib/therapy 재수출본을 그대로 재사용한다(중복 구현하지 않음).
 */
export function MedTimelineScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const { personId, personName } = route.params;

  const [filter, setFilter] = useState<DomainKey | "ALL">("MED");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TimelineItem[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      const data = await getTimeline(personId, filter === "ALL" ? undefined : filter);
      if (alive) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [personId, filter]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <Text style={styles.title}>치료 타임라인{personName ? ` · ${personName}` : ""}</Text>
      <Text style={styles.sub}>기록을 시간순으로 확인합니다.</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        accessibilityLabel="도메인 필터"
      >
        {DOMAIN_FILTERS.map((f) => {
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
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={PRIMARY[600]} style={{ marginTop: SPACING.xl }} />
      ) : items.length === 0 ? (
        <Text style={styles.muted}>해당 조건의 기록이 없습니다.</Text>
      ) : (
        items.map((it) => (
          <View key={it.id} style={[styles.tlItem, it.isMilestone && styles.tlItemMilestone]}>
            <Text style={styles.tlDate}>{formatShortDate(it.date)}</Text>
            <Text style={styles.tlTitle}>{it.title}</Text>
            <View style={styles.tlBadges}>
              <DomainChip domain={it.domain} />
              {it.isMilestone ? <Text style={styles.milestone}>◆ 이정표</Text> : null}
              {it.tags.slice(0, 3).map((t) => (
                <Text key={t} style={styles.tagBadge}>
                  {t}
                </Text>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  filterRow: { gap: SPACING.sm, paddingVertical: SPACING.lg },
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
  tlItem: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderLeftWidth: 4,
    borderLeftColor: NEUTRAL.border,
  },
  tlItemMilestone: { borderLeftColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  tlDate: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textMuted },
  tlTitle: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text, marginTop: 4 },
  tlBadges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACING.xs, marginTop: SPACING.sm },
  milestone: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY[700],
    backgroundColor: PRIMARY[100],
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  tagBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: NEUTRAL.textMuted,
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
});
