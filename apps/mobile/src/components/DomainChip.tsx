import { StyleSheet, Text, View } from "react-native";
import { DOMAIN_COLORS, type DomainKey } from "../theme/colors";
import { RADIUS } from "../theme/colors";

/** 6도메인 배지 칩. 색상은 @ongil/shared DOMAIN_COLORS(SSOT)를 사용한다. */
const DOMAIN_LABELS: Record<DomainKey, string> = {
  MED: "의료",
  EDU: "교육",
  WEL: "복지",
  DAI: "일상",
  TRA: "전환",
  LEG: "법률",
};

export function DomainChip({ domain }: { domain: string }) {
  const key = (domain in DOMAIN_COLORS ? domain : "DAI") as DomainKey;
  const c = DOMAIN_COLORS[key];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{DOMAIN_LABELS[key]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: 12, fontWeight: "700" },
});
