import { StyleSheet, View } from "react-native";
import type { TimelineItem } from "../../lib/iep";
import { DraftBadge } from "./DraftBadge";
import { TimelineCardBody } from "./RecordTimelineCard";
import { ACCENT, RADIUS, SPACING } from "../../theme/colors";

/**
 * MilestoneCard(§6-2) — 이정표 카드(144px, 황금 테두리 #FAC775). is_milestone=true 기록에 쓴다.
 * 콘텐츠는 RecordTimelineCard의 TimelineCardBody를 재사용하고 컨테이너만 강조한다.
 */
export function MilestoneCard({ item }: { item: TimelineItem }) {
  return (
    <View style={styles.card} accessibilityRole="text" accessibilityLabel={`이정표. ${item.title}`}>
      {item.isDraft ? <DraftBadge /> : null}
      <TimelineCardBody item={item} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 144,
    justifyContent: "center",
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: ACCENT.amber,
    backgroundColor: `${ACCENT.amber}1A`,
  },
});
