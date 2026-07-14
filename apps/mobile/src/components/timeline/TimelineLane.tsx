import { Fragment } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { DomainKey } from "@ongil/validation";
import { lifeStageBoundaryISO, type TimelineItem } from "../../lib/iep";
import { DomainChip } from "../DomainChip";
import { formatShortDate } from "../../lib/date";
import { ACCENT, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../../theme/colors";

/**
 * TimelineLane(§6-2) — 도메인 병렬 레인. 웹의 repeat(6,1fr) CSS Grid를 RN에서는 가로 스크롤
 * 컬럼으로 옮긴다. 각 컬럼 상단에 DomainChip, 아래로 해당 도메인 기록 카드를 세로로 쌓는다.
 * 기록이 있는 도메인만 컬럼으로 노출한다.
 *
 * birthDate가 주어지면 각 레인에서 만 14/18세 도달 시점이 표시 기록 범위 안에 들 때만 구분선을
 * 그 시점 위치(내림차순 카드 사이)에 삽입한다.
 */
const LANE_WIDTH = 220;

interface Boundary {
  years: number;
  iso: string;
}

function boundariesFor(birthDate?: string): Boundary[] {
  if (!birthDate) return [];
  const result: Boundary[] = [];
  for (const years of [14, 18]) {
    const iso = lifeStageBoundaryISO(birthDate, years);
    if (iso) result.push({ years, iso });
  }
  return result;
}

export function TimelineLane({
  items,
  domains,
  birthDate,
}: {
  items: TimelineItem[];
  domains: DomainKey[];
  birthDate?: string;
}) {
  const lanes = domains.filter((d) => items.some((it) => it.domain === d));
  const boundaries = boundariesFor(birthDate);

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
            {laneItems.map((it, idx) => {
              const next = laneItems[idx + 1];
              // 내림차순이므로 경계일이 현재 카드(신)와 다음 카드(구) 사이에 들면 그 아래에 구분선.
              const divider = next
                ? boundaries.find((b) => it.date >= b.iso && next.date < b.iso)
                : undefined;
              return (
                <Fragment key={it.id}>
                  <View
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
                  {divider ? (
                    <View
                      style={styles.boundaryRow}
                      accessibilityRole="text"
                      accessibilityLabel={`만 ${divider.years}세 도달`}
                    >
                      <View style={styles.boundaryLine} />
                      <Text style={styles.boundaryLabel}>만 {divider.years}세</Text>
                      <View style={styles.boundaryLine} />
                    </View>
                  ) : null}
                </Fragment>
              );
            })}
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
  boundaryRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 2 },
  boundaryLine: { flex: 1, height: 1, backgroundColor: PRIMARY[400] },
  boundaryLabel: { fontSize: FONT.caption, fontWeight: "800", color: PRIMARY[700] },
});
