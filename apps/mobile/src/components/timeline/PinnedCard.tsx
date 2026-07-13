import { StyleSheet, Text, View } from "react-native";
import type { EmergencyInfoInput } from "@ongil/validation";
import { NEUTRAL, RADIUS, SPACING } from "../../theme/colors";

/**
 * PinnedCard(§6-2) — 응급 대응 정보 카드(빨간 테두리 #E04545). 타임라인 최상단에 항상 고정한다.
 * 데이터 소스는 당사자 프로필의 emergency_info(§G-10). 없으면 "정보 없음"으로 표시한다.
 * accessibilityRole="summary"로 스크린리더가 요약 영역으로 인식하게 한다.
 */
const PIN_RED = "#E04545";

export function PinnedCard({
  personName,
  emergencyInfo,
}: {
  personName: string;
  emergencyInfo: EmergencyInfoInput | null;
}) {
  const e = emergencyInfo;
  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`${personName} 응급 대응 정보`}
    >
      <Text style={styles.title}>🚨 응급 대응 정보 — {personName}</Text>
      <Row label="알레르기" value={e?.allergies?.join(", ")} />
      <Row label="복용약" value={e?.medications?.join(", ")} />
      <Row
        label="비상연락"
        value={e?.contacts
          ?.map((c) => `${c.name}${c.relation ? `(${c.relation})` : ""} ${c.phone}`)
          .join("\n")}
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value?.trim() ? value : "정보 없음"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.dangerBg,
    borderWidth: 1.5,
    borderColor: PIN_RED,
  },
  title: { fontSize: 15, fontWeight: "800", color: NEUTRAL.danger, marginBottom: SPACING.sm },
  row: { flexDirection: "row", paddingVertical: 4, gap: SPACING.md },
  label: { width: 72, fontSize: 13, color: NEUTRAL.danger, fontWeight: "600" },
  value: { flex: 1, fontSize: 13, color: NEUTRAL.text },
});
