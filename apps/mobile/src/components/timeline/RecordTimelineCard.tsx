import { StyleSheet, Text, View } from "react-native";
import type { TimelineItem } from "../../lib/iep";
import { DomainChip } from "../DomainChip";
import { DraftBadge } from "./DraftBadge";
import { formatShortDate } from "../../lib/date";
import { ACCENT, FONT, NEUTRAL, RADIUS, SPACING } from "../../theme/colors";

/**
 * RecordTimelineCard(§6-2) — 기본 타임라인 카드(≈96px). 날짜·제목·도메인 chip·태그를 렌더한다.
 * is_draft면 우상단 DraftBadge, is_pinned면 고정 마커를 함께 노출한다.
 * 카드 내부 콘텐츠(TimelineCardBody)는 MilestoneCard가 재사용한다(중복 방지).
 */

/** 카드 컨테이너 내부 공통 콘텐츠 — RecordTimelineCard·MilestoneCard가 공유한다. */
export function TimelineCardBody({ item }: { item: TimelineItem }) {
  return (
    <>
      <Text style={styles.date}>{formatShortDate(item.date)}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.badges}>
        <DomainChip domain={item.domain} />
        {item.isPinned ? <Text style={styles.pin}>📌 고정</Text> : null}
        {item.isMilestone ? <Text style={styles.milestone}>◆ 이정표</Text> : null}
        {item.tags.slice(0, 3).map((t) => (
          <Text key={t} style={styles.tag}>
            {t}
          </Text>
        ))}
      </View>
    </>
  );
}

export function RecordTimelineCard({ item }: { item: TimelineItem }) {
  const label = `${formatShortDate(item.date)} ${item.title}${
    item.isMilestone ? ", 이정표" : ""
  }${item.isDraft ? ", 임시저장" : ""}`;
  return (
    <View
      style={[styles.card, item.isPinned && styles.cardPinned]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {item.isDraft ? <DraftBadge /> : null}
      <TimelineCardBody item={item} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
    justifyContent: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  cardPinned: { borderLeftWidth: 4, borderLeftColor: NEUTRAL.danger },
  date: { fontSize: FONT.caption, fontWeight: "700", color: NEUTRAL.textMuted },
  title: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text, marginTop: 4 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  pin: {
    fontSize: 11,
    fontWeight: "700",
    color: NEUTRAL.danger,
    backgroundColor: NEUTRAL.dangerBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  milestone: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B56F10",
    backgroundColor: `${ACCENT.amber}40`,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  tag: {
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
