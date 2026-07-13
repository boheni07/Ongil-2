import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { DomainKey } from "@ongil/validation";
import type { TimelineItem } from "../../lib/iep";
import { DomainChip } from "../DomainChip";
import { formatShortDate } from "../../lib/date";
import { ACCENT, FONT, NEUTRAL, RADIUS, SPACING } from "../../theme/colors";

/**
 * TimelineLane(§6-2) — 도메인 병렬 레인. 웹의 repeat(6,1fr) CSS Grid를 RN에서는 가로 스크롤
 * 컬럼으로 옮긴다. 각 컬럼 상단에 DomainChip, 아래로 해당 도메인 기록 카드를 세로로 쌓는다.
 * 기록이 있는 도메인만 컬럼으로 노출한다.
 */
const LANE_WIDTH = 220;

export function TimelineLane({
  items,
  domains,
}: {
  items: TimelineItem[];
  domains: DomainKey[];
}) {
  const lanes = domains.filter((d) => items.some((it) => it.domain === d));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="도메인 병렬 레인"
    >
      {lanes.map((d) => {
        const laneItems = items.filter((it) => it.domain === d);
        return (
          <View key={d} style={styles.lane}>
            <DomainChip domain={d} />
            {laneItems.map((it) => (
              <View
                key={it.id}
                style={[styles.laneCard, it.isMilestone && styles.laneCardMilestone]}
                accessibilityRole="text"
                accessibilityLabel={`${formatShortDate(it.date)} ${it.title}${
                  it.isMilestone ? ", 이정표" : ""
                }`}
              >
                <Text style={styles.laneDate}>{formatShortDate(it.date)}</Text>
                <Text style={styles.laneTitle}>
                  {it.title}
                  {it.isMilestone ? <Text style={styles.laneMilestone}> ◆</Text> : null}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACING.md, paddingVertical: SPACING.sm },
  lane: { width: LANE_WIDTH, gap: SPACING.sm },
  laneCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  laneCardMilestone: { borderColor: ACCENT.amber, borderWidth: 2 },
  laneDate: { fontSize: FONT.caption, fontWeight: "700", color: NEUTRAL.textMuted },
  laneTitle: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text, marginTop: 2 },
  laneMilestone: { color: ACCENT.amber, fontWeight: "800" },
});
