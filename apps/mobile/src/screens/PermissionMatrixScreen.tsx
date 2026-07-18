import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DomainKey, Role } from "@ongil/validation";
import {
  cyclePermissionCell,
  getPermissionMatrix,
  type CellLevel,
  type PermissionMatrixRow,
} from "../lib/permissions";
import { getGuardianPersons } from "../lib/guardian";
import { computeLifeStage, isSelfConfirmingStage } from "../lib/iep";
import { ErrorBanner } from "../components/ui";
import { DOMAIN_COLORS, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "PermissionMatrix">;

/** 6도메인 표시 순서·라벨 (permissions.domain CHECK 순서와 동일). */
const DOMAINS: { key: DomainKey; label: string }[] = [
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

/** 셀 순환 4단계의 색·라벨 — 프로토타입 web-guardian.html 범례와 동일. */
const LEVEL_META: Record<CellLevel, { bg: string; fg: string; label: string }> = {
  none: { bg: "#F3F4F6", fg: "#6B7280", label: "없음" },
  read: { bg: "#3B82F6", fg: "#FFFFFF", label: "읽기" },
  write: { bg: "#10B981", fg: "#FFFFFF", label: "작성" },
  edit: { bg: "#F59E0B", fg: "#1A1C1A", label: "편집" },
};

const ROLE_LABEL: Record<Role, string> = {
  person: "당사자",
  guardian: "보호자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

/**
 * G-30 권한 매트릭스(모바일) — 협력자별 카드 + 6도메인 칩 그리드.
 * 표는 모바일에서 좁으므로 웹의 표 대신 grantee 카드 + 도메인 칩 격자로 옮겼다.
 * 칩을 탭하면 회색→읽기→작성→편집→회색 순으로 순환(cyclePermissionCell).
 */
export function PermissionMatrixScreen({ route, navigation }: Props) {
  const { personId, personName } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PermissionMatrixRow[]>([]);
  const [isAdult, setIsAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [matrix, persons] = await Promise.all([
      getPermissionMatrix(personId),
      getGuardianPersons(),
    ]);
    setRows(matrix);
    const me = persons.find((p) => p.id === personId) ?? null;
    setIsAdult(me?.birthDate ? isSelfConfirmingStage(computeLifeStage(me.birthDate)) : false);
    setLoading(false);
  }, [personId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onCellPress = async (granteeId: string, domain: DomainKey) => {
    const cellKey = `${granteeId}:${domain}`;
    if (busyCell) return;
    setBusyCell(cellKey);
    setError(null);
    const res = await cyclePermissionCell(personId, granteeId, domain);
    setBusyCell(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    // 낙관적 갱신: 반환된 newLevel을 셀에 반영(none이면 제거).
    setRows((prev) =>
      prev.map((r) => {
        if (r.granteeId !== granteeId) return r;
        const cells = { ...r.cells };
        if (res.newLevel === "none") {
          delete cells[domain];
        } else {
          cells[domain] = {
            accessLevel: res.newLevel,
            validUntil: cells[domain]?.validUntil ?? null,
          };
        }
        return { ...r, cells };
      })
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <Text style={styles.title}>{personName} 권한 관리</Text>
      <Text style={styles.subtle}>
        칩을 탭하면 없음 → 읽기 → 작성 → 편집 순으로 순환합니다.
      </Text>

      {isAdult ? (
        <View
          style={styles.adultBanner}
          accessibilityRole="text"
          accessibilityLabel={`성인기 진입, 본인 동의 이관 완료. ${personName} 님은 성인기에 진입하여 기록·동의의 주체가 본인으로 이관되었습니다. 권한의 부여·회수는 당사자 본인의 동의를 전제로 신중하게 관리해주세요.`}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.adultBannerTitle}>성인기 진입 · 본인 동의 이관 완료</Text>
          <Text style={styles.adultBannerBody}>
            {personName} 님은 성인기에 진입하여 기록·동의의 주체가 본인으로 이관되었습니다. 권한의
            부여·회수는 당사자 본인의 동의를 전제로 신중하게 관리해주세요.
          </Text>
        </View>
      ) : null}

      <View style={styles.legend} accessibilityLabel="범례">
        {(Object.keys(LEVEL_META) as CellLevel[]).map((lv) => (
          <View key={lv} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: LEVEL_META[lv].bg }]} />
            <Text style={styles.legendText}>{LEVEL_META[lv].label}</Text>
          </View>
        ))}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {rows.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>아직 권한을 부여한 협력자가 없습니다.</Text>
        </View>
      ) : (
        rows.map((row) => (
          <View key={row.granteeId} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.granteeName}>{row.granteeName}</Text>
              <Text style={styles.granteeRole}>{ROLE_LABEL[row.granteeRole]}</Text>
            </View>
            <View style={styles.grid}>
              {DOMAINS.map(({ key, label }) => {
                const cell = row.cells[key];
                const level: CellLevel = cell?.accessLevel ?? "none";
                const meta = LEVEL_META[level];
                const cellKey = `${row.granteeId}:${key}`;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.granteeName} ${label} ${meta.label}. 탭하여 변경`}
                    accessibilityState={{ busy: busyCell === cellKey }}
                    onPress={() => onCellPress(row.granteeId, key)}
                    disabled={busyCell !== null}
                    style={({ pressed }) => [
                      styles.cell,
                      { backgroundColor: meta.bg },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.cellDomain, { color: meta.fg }]}>{label}</Text>
                    <Text style={[styles.cellLevel, { color: meta.fg }]}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="새 권한 부여"
        onPress={() => navigation.navigate("PermissionGrant", { personId, personName })}
        style={({ pressed }) => [styles.grantBtn, pressed && styles.pressed]}
      >
        <Text style={styles.grantBtnText}>＋ 새 권한 부여</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 4 },
  adultBanner: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: DOMAIN_COLORS.DAI.bg,
    borderWidth: 1,
    borderColor: DOMAIN_COLORS.DAI.accent,
  },
  adultBannerTitle: { fontSize: FONT.body, fontWeight: "800", color: DOMAIN_COLORS.DAI.text },
  adultBannerBody: { fontSize: 13, color: NEUTRAL.text, marginTop: 4, lineHeight: 20 },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  legendSwatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: NEUTRAL.border },
  legendText: { fontSize: FONT.caption, color: NEUTRAL.textMuted },
  emptyBox: {
    padding: SPACING.xl,
    alignItems: "center",
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  emptyText: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  card: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
  },
  cardHead: { flexDirection: "row", alignItems: "baseline", gap: SPACING.sm, marginBottom: SPACING.md },
  granteeName: { fontSize: FONT.h3, fontWeight: "800", color: NEUTRAL.text },
  granteeRole: { fontSize: FONT.caption, fontWeight: "600", color: PRIMARY[700] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  cell: {
    width: "31%",
    flexGrow: 1,
    minHeight: 56,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  cellDomain: { fontSize: 14, fontWeight: "800" },
  cellLevel: { fontSize: 12, fontWeight: "600" },
  pressed: { opacity: 0.8 },
  grantBtn: {
    marginTop: SPACING.xl,
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  grantBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
