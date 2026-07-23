import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EmergencyInfoInput } from "@ongil/validation";
import {
  getGuardianPersons,
  getPersonSummaryCards,
  type GuardianPerson,
  type PersonSummaryCards,
} from "../lib/guardian";
import { computeLifeStage } from "../lib/iep";
import { koreanAge, relativeDay } from "../lib/date";
import { DomainChip } from "../components/DomainChip";
import { PendingConfirmCard } from "../components/dashboard/PendingConfirmCard";
import { NotificationBell } from "../components/NotificationBell";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "GuardianDashboard">;

/** G-01 보호자 대시보드 — 당사자 슬라이더, 응급정보, 최근기록·권한·알림 카드. */
export function GuardianDashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [persons, setPersons] = useState<GuardianPerson[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PersonSummaryCards | null>(null);
  // 웹 PersonSlider.tsx와 동일하게 3명 이상일 때만 그리드 보기를 노출한다(docs/13 Wave Q-4 —
  // 다자녀 보호자가 가로 슬라이더만으로는 전체를 훑어보기 어렵다는 리빙랩 관찰이 근거).
  const [viewMode, setViewMode] = useState<"slider" | "grid">("slider");

  const load = useCallback(async () => {
    const list = await getGuardianPersons();
    setPersons(list);
    setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!selectedId) {
      setSummary(null);
      return;
    }
    void (async () => setSummary(await getPersonSummaryCards(selectedId)))();
  }, [selectedId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} />
      </View>
    );
  }

  const selected = persons.find((p) => p.id === selectedId) ?? null;
  const emergency = (selected?.emergencyInfo as EmergencyInfoInput | null) ?? null;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>대시보드</Text>
          <Text style={styles.subtle}>피보호자 현황을 한눈에 확인하세요.</Text>
        </View>
        <View style={styles.topActions}>
          <NotificationBell onPress={() => navigation.navigate("Notifications")} />
        </View>
      </View>

      {persons.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>아직 등록된 당사자가 없습니다.</Text>
        </View>
      ) : (
        <>
          {persons.length > 2 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={viewMode === "slider" ? "그리드로 보기" : "슬라이더로 보기"}
              onPress={() => setViewMode((m) => (m === "slider" ? "grid" : "slider"))}
              style={({ pressed }) => [styles.viewToggle, pressed && styles.pressed]}
            >
              <Text style={styles.viewToggleText}>
                {viewMode === "slider" ? "⊞ 그리드로 보기" : "⟷ 슬라이더로 보기"}
              </Text>
            </Pressable>
          )}

          {viewMode === "slider" || persons.length <= 2 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.slider}
              accessibilityLabel="당사자 슬라이더"
            >
              {persons.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  selected={p.id === selectedId}
                  onSelect={() => setSelectedId(p.id)}
                  style={styles.personCard}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.grid}>
              {persons.map((p) => (
                <PersonCard
                  key={p.id}
                  person={p}
                  selected={p.id === selectedId}
                  onSelect={() => setSelectedId(p.id)}
                  style={styles.personCardGrid}
                />
              ))}
            </View>
          )}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="당사자 추가"
        onPress={() => navigation.navigate("PersonRegister")}
        style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
      >
        <Text style={styles.addBtnText}>＋ 당사자 추가</Text>
      </Pressable>

      {selected ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${selected.fullName} 정보 수정`}
            onPress={() => navigation.navigate("PersonRegister", { person: selected })}
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          >
            <Text style={styles.editBtnText}>✎ {selected.fullName} 정보 수정</Text>
          </Pressable>

          <View style={styles.pinned}>
            <Text style={styles.pinnedTitle}>🚨 응급 대응 정보 — {selected.fullName}</Text>
            <EmergencyRow label="알레르기" value={emergency?.allergies?.join(", ")} />
            <EmergencyRow label="복용약" value={emergency?.medications?.join(", ")} />
            <EmergencyRow
              label="비상연락"
              value={emergency?.contacts
                ?.map((c) => `${c.name}${c.relation ? `(${c.relation})` : ""} ${c.phone}`)
                .join("\n")}
            />
          </View>

          <PendingConfirmCard
            count={summary?.pendingConfirmationCount ?? 0}
            onPress={() =>
              navigation.navigate("RecordManager", {
                personId: selected.id,
                personName: selected.fullName,
              })
            }
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>최근 기록</Text>
            {summary && summary.recentRecords.length > 0 ? (
              summary.recentRecords.map((r) => (
                <View key={r.id} style={styles.recRow}>
                  <DomainChip domain={r.domain} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recType}>{r.recordType}</Text>
                    <Text style={styles.recDate}>{relativeDay(r.recordDate)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>최근 기록이 없습니다.</Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${selected.fullName} 전체 기록 보기`}
              onPress={() =>
                navigation.navigate("RecordManager", {
                  personId: selected.id,
                  personName: selected.fullName,
                })
              }
              style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.pressed]}
            >
              <Text style={styles.actionBtnOutlineText}>전체 기록 보기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${selected.fullName} 생애주기 타임라인 보기`}
              onPress={() =>
                navigation.navigate("Timeline", {
                  personId: selected.id,
                  personName: selected.fullName,
                })
              }
              style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.pressed]}
            >
              <Text style={styles.actionBtnOutlineText}>생애주기 타임라인 보기</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>권한 현황</Text>
            <Text style={styles.permCount}>
              활성 권한 {summary?.permissionCount ?? 0}건
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${selected.fullName} 권한 매트릭스 열기`}
              onPress={() =>
                navigation.navigate("PermissionMatrix", {
                  personId: selected.id,
                  personName: selected.fullName,
                })
              }
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.actionBtnText}>권한 매트릭스</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${selected.fullName}에게 권한 부여하기`}
              onPress={() =>
                navigation.navigate("PermissionGrant", {
                  personId: selected.id,
                  personName: selected.fullName,
                })
              }
              style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.pressed]}
            >
              <Text style={styles.actionBtnOutlineText}>＋ 권한 부여하기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${selected.fullName} 접근 로그 보기`}
              onPress={() =>
                navigation.navigate("AccessLogs", {
                  personId: selected.id,
                  personName: selected.fullName,
                })
              }
              style={({ pressed }) => [styles.actionBtnOutline, pressed && styles.pressed]}
            >
              <Text style={styles.actionBtnOutlineText}>접근 로그 보기</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>알림</Text>
            <Text style={styles.muted}>새 알림이 없습니다.</Text>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function PersonCard({
  person: p,
  selected,
  onSelect,
  style,
}: {
  person: GuardianPerson;
  selected: boolean;
  onSelect: () => void;
  style: StyleProp<ViewStyle>;
}) {
  const age = koreanAge(p.birthDate);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${p.fullName}${age != null ? ` 만 ${age}세` : ""}`}
      onPress={onSelect}
      style={[styles.personCardBase, style, selected && styles.personCardSel]}
    >
      <View style={styles.pcHead}>
        <Text style={styles.avatar}>🧑</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.pcName}>{p.fullName}</Text>
          <Text style={styles.pcMeta}>
            {p.birthDate}
            {age != null ? ` · 만 ${age}세` : ""}
          </Text>
          <Text style={styles.pcMeta}>
            {p.disabilityTypes.length ? p.disabilityTypes.join(", ") : "장애정보 미등록"}
            {p.disabilityDegree ? ` · ${p.disabilityDegree === "severe" ? "심함" : "심하지 않음"}` : ""}
          </Text>
        </View>
      </View>
      {/* docs/13 Wave Q-4: 웹 카드는 생애주기 배지를 쓰는데 모바일은 "성년" 텍스트 태그로
          축약돼 있던 정보 밀도 격차를 해소 — 웹과 동일하게 StageBadge로 통일한다. */}
      <StageBadge lifeStage={computeLifeStage(p.birthDate)} style={styles.stageBadge} />
    </Pressable>
  );
}

function EmergencyRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.emRow}>
      <Text style={styles.emLabel}>{label}</Text>
      <Text style={styles.emValue}>{value?.trim() ? value : "정보 없음"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  topRow: { flexDirection: "row", alignItems: "flex-start" },
  title: { fontSize: FONT.h1, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  topActions: { alignItems: "flex-end", gap: SPACING.sm },
  settingsLink: { fontSize: 14, fontWeight: "600", color: PRIMARY[600] },
  logout: { fontSize: 14, fontWeight: "600", color: PRIMARY[600] },
  emptyBox: { padding: SPACING.xl, alignItems: "center", backgroundColor: NEUTRAL.surface, borderRadius: RADIUS.md, marginTop: SPACING.lg },
  emptyText: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  slider: { gap: SPACING.md, paddingVertical: SPACING.lg },
  viewToggle: {
    alignSelf: "flex-end",
    marginTop: SPACING.md,
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  viewToggleText: { fontSize: 13, fontWeight: "700", color: NEUTRAL.text },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  personCardBase: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  personCard: { width: 260 },
  personCardGrid: { flexBasis: "47%", flexGrow: 1 },
  personCardSel: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  pcHead: { flexDirection: "row", gap: SPACING.md, alignItems: "center" },
  avatar: { fontSize: 40 },
  pcName: { fontSize: 18, fontWeight: "800", color: NEUTRAL.text },
  pcMeta: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 2 },
  stageBadge: { marginTop: SPACING.sm },
  addBtn: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY[50],
  },
  addBtnText: { fontSize: 16, fontWeight: "700", color: PRIMARY[700] },
  editBtn: {
    marginTop: SPACING.lg,
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEUTRAL.bg,
  },
  editBtnText: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text },
  pressed: { opacity: 0.85 },
  pinned: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.dangerBg,
    borderWidth: 1,
    borderColor: "#F3C0C0",
  },
  pinnedTitle: { fontSize: 15, fontWeight: "800", color: NEUTRAL.danger, marginBottom: SPACING.sm },
  emRow: { flexDirection: "row", paddingVertical: 4, gap: SPACING.md },
  emLabel: { width: 72, fontSize: 13, color: NEUTRAL.danger, fontWeight: "600" },
  emValue: { flex: 1, fontSize: 13, color: NEUTRAL.text },
  card: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
  },
  cardTitle: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.sm },
  recRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: 6 },
  recType: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text },
  recDate: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: 2 },
  permCount: { fontSize: 15, fontWeight: "700", color: PRIMARY[700], marginBottom: SPACING.sm },
  muted: { fontSize: 14, color: NEUTRAL.textMuted },
  actionBtn: {
    marginTop: SPACING.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
  },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  actionBtnOutline: {
    marginTop: SPACING.sm,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    backgroundColor: PRIMARY[50],
  },
  actionBtnOutlineText: { fontSize: 16, fontWeight: "700", color: PRIMARY[700] },
});
