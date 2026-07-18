import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { DOMAIN_COLORS } from "@ongil/shared";
import type { LifeStage } from "../../lib/iep";
import { RADIUS } from "../../theme/colors";

/**
 * docs/03-uiux.md §6-6 생애주기 단계 배지(모바일) — 웹 StageBadge.tsx의 RN 이식본.
 * life_stage(infant/child/youth_transition/adult/senior, 5단계) 에 아이콘+라벨+색상을 표시한다.
 * 색상은 웹과 동일하게 도메인 톤(wel/edu/tra/dai/leg)을 재사용하고 좌측 4px 색상 바로
 * "상태 배지"임을 시각적으로 구분한다.
 * 접근성(WCAG 1.4.1): 색상만이 아니라 항상 아이콘+텍스트 라벨을 함께 노출한다.
 *
 * simple=true면 당사자 모드용 쉬운 문구("아기 때"/"어린이 때"/"청소년"/"어른"/"어르신")를 쓴다(웹과 값 일치).
 */

interface StageMeta {
  label: string;
  simpleLabel: string;
  icon: string;
  bg: string;
  text: string;
  bar: string;
}

const STAGE_META: Record<LifeStage, StageMeta> = {
  infant: {
    label: "영유아기",
    simpleLabel: "아기 때",
    icon: "🍼",
    bg: DOMAIN_COLORS.WEL.bg,
    text: DOMAIN_COLORS.WEL.text,
    bar: DOMAIN_COLORS.WEL.accent,
  },
  child: {
    label: "아동기",
    simpleLabel: "어린이 때",
    icon: "🧒",
    bg: DOMAIN_COLORS.EDU.bg,
    text: DOMAIN_COLORS.EDU.text,
    bar: DOMAIN_COLORS.EDU.accent,
  },
  youth_transition: {
    label: "청소년 전환기",
    simpleLabel: "청소년",
    icon: "🌱",
    bg: DOMAIN_COLORS.TRA.bg,
    text: DOMAIN_COLORS.TRA.text,
    bar: DOMAIN_COLORS.TRA.accent,
  },
  adult: {
    label: "성인기",
    simpleLabel: "어른",
    icon: "🧑",
    bg: DOMAIN_COLORS.DAI.bg,
    text: DOMAIN_COLORS.DAI.text,
    bar: DOMAIN_COLORS.DAI.accent,
  },
  senior: {
    label: "노년기",
    simpleLabel: "어르신",
    icon: "👵",
    bg: DOMAIN_COLORS.LEG.bg,
    text: DOMAIN_COLORS.LEG.text,
    bar: DOMAIN_COLORS.LEG.accent,
  },
};

export function StageBadge({
  lifeStage,
  simple = false,
  style,
}: {
  lifeStage: LifeStage;
  simple?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const meta = STAGE_META[lifeStage];
  const label = simple ? meta.simpleLabel : meta.label;

  return (
    <View
      style={[styles.badge, { backgroundColor: meta.bg }, style]}
      accessibilityRole="text"
      accessibilityLabel={`생애주기 단계: ${label}`}
    >
      <View style={[styles.bar, { backgroundColor: meta.bar }]} />
      <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
        {meta.icon}
      </Text>
      <Text style={[styles.label, { color: meta.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: RADIUS.sm,
    overflow: "hidden",
    paddingRight: 10,
    gap: 6,
  },
  bar: { width: 4, alignSelf: "stretch" },
  icon: { fontSize: 14, marginLeft: 6 },
  label: { fontSize: 13, fontWeight: "700" },
});
