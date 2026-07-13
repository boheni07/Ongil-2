import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DomainKey, EmergencyInfoInput } from "@ongil/validation";
import type { TimelineItem } from "../../lib/iep";
import { PinnedCard } from "./PinnedCard";
import { MilestoneCard } from "./MilestoneCard";
import { RecordTimelineCard } from "./RecordTimelineCard";
import { TimelineLane } from "./TimelineLane";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../../theme/colors";

/**
 * TimelineView(§6-2) — 타임라인 최상위 공통 컴포넌트. EduTimeline·WelTimeline·MedTimeline과
 * G-10 생애주기 타임라인이 공유한다. 스트림/레인 뷰 토글 + 도메인 필터 + 상단 PinnedCard(선택)를
 * 조합한다.
 *
 * 필터·데이터 조회는 화면(부모)이 소유한다(controlled): 필터 변경 시 부모가 getTimeline을
 * 도메인 인자와 함께 재조회한다(기존 3개 화면의 서버측 필터 동작을 그대로 보존). 뷰 토글만
 * 내부 상태로 관리한다. emergencyInfo가 주어질 때만 PinnedCard를 최상단에 노출한다(G-10 전용).
 */

const DOMAIN_FILTERS: { key: DomainKey | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

type ViewMode = "stream" | "lane";

export function TimelineView({
  title,
  personName,
  items,
  loading,
  filter,
  onFilterChange,
  emergencyInfo,
}: {
  title: string;
  personName: string;
  items: TimelineItem[];
  loading: boolean;
  filter: DomainKey | "ALL";
  onFilterChange: (f: DomainKey | "ALL") => void;
  emergencyInfo?: EmergencyInfoInput | null;
}) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewMode>("stream");

  const domains = useMemo(() => {
    const set = new Set<DomainKey>();
    for (const it of items) set.add(it.domain);
    return [...set];
  }, [items]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <Text style={styles.title}>
        {title}
        {personName ? ` · ${personName}` : ""}
      </Text>
      <Text style={styles.sub}>기록을 시간순으로 확인합니다.</Text>

      <View style={styles.viewToggle} accessibilityRole="tablist" accessibilityLabel="타임라인 보기 방식">
        <ViewButton label="스트림 뷰" active={view === "stream"} onPress={() => setView("stream")} />
        <ViewButton label="레인 뷰" active={view === "lane"} onPress={() => setView("lane")} />
      </View>

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
              onPress={() => onFilterChange(f.key)}
              style={({ pressed }) => [
                styles.filterChip,
                sel && styles.filterChipSel,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterText, sel && styles.filterTextSel]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {emergencyInfo !== undefined ? (
        <View style={styles.pinnedWrap}>
          <PinnedCard personName={personName} emergencyInfo={emergencyInfo ?? null} />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={PRIMARY[600]} style={{ marginTop: SPACING.xl }} />
      ) : items.length === 0 ? (
        <Text style={styles.muted}>해당 조건의 기록이 없습니다.</Text>
      ) : view === "stream" ? (
        <View style={styles.stream}>
          {items.map((it) =>
            it.isMilestone ? (
              <MilestoneCard key={it.id} item={it} />
            ) : (
              <RecordTimelineCard key={it.id} item={it} />
            )
          )}
        </View>
      ) : (
        <View style={styles.laneWrap}>
          <TimelineLane items={items} domains={domains} />
        </View>
      )}
    </ScrollView>
  );
}

function ViewButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.viewBtn, active && styles.viewBtnSel, pressed && styles.pressed]}
    >
      <Text style={[styles.viewBtnText, active && styles.viewBtnTextSel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  viewToggle: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginTop: SPACING.lg,
    padding: 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    alignSelf: "flex-start",
  },
  viewBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  viewBtnSel: { backgroundColor: PRIMARY[50] },
  viewBtnText: { fontSize: 14, fontWeight: "600", color: NEUTRAL.textMuted },
  viewBtnTextSel: { color: PRIMARY[800] },
  filterRow: { gap: SPACING.sm, paddingVertical: SPACING.lg },
  filterChip: {
    minHeight: 44,
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
  pinnedWrap: { marginBottom: SPACING.md },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: SPACING.lg },
  stream: { gap: SPACING.md },
  laneWrap: { marginTop: SPACING.sm },
});
