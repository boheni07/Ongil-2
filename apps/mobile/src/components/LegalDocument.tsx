import { StyleSheet, Text, View } from "react-native";
import { ScreenScaffold } from "./ScreenScaffold";
import { NEUTRAL, SPACING } from "../theme/colors";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

/** A-09 이용약관 / A-10 개인정보처리방침 공통 정적 스크롤 레이아웃. */
export function LegalDocument({ meta, sections }: { meta: string; sections: LegalSection[] }) {
  return (
    <ScreenScaffold>
      <Text style={styles.meta}>{meta}</Text>
      {sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.heading}>{s.heading}</Text>
          {s.paragraphs?.map((p, i) => (
            <Text key={i} style={styles.para}>
              {p}
            </Text>
          ))}
          {s.bullets?.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 12, color: NEUTRAL.textMuted, marginBottom: SPACING.lg },
  section: { marginBottom: SPACING.lg },
  heading: { fontSize: 16, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.sm },
  para: { fontSize: 14, color: NEUTRAL.text, lineHeight: 22, marginBottom: SPACING.xs },
  bulletRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.xs },
  bulletDot: { fontSize: 14, color: NEUTRAL.textMuted, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: NEUTRAL.text, lineHeight: 22 },
});
