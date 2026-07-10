import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EmergencyInfoInput } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import {
  getGuardianPersons,
  getPersonSummaryCards,
  type GuardianPerson,
  type PersonSummaryCards,
} from "../lib/guardian";
import { koreanAge, relativeDay } from "../lib/date";
import { DomainChip } from "../components/DomainChip";
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          onPress={() => supabase.auth.signOut()}
          hitSlop={8}
        >
          <Text style={styles.logout}>로그아웃</Text>
        </Pressable>
      </View>

      {persons.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>아직 등록된 당사자가 없습니다.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.slider}
          accessibilityLabel="당사자 슬라이더"
        >
          {persons.map((p) => {
            const sel = p.id === selectedId;
            const age = koreanAge(p.birthDate);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${p.fullName}${age != null ? ` 만 ${age}세` : ""}`}
                onPress={() => setSelectedId(p.id)}
                style={[styles.personCard, sel && styles.personCardSel]}
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
                {p.isAdult ? <Text style={styles.adultTag}>성년</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
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
            <DisabledButton label="전체 기록 보기 (준비 중)" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>권한 현황</Text>
            <Text style={styles.permCount}>
              활성 권한 {summary?.permissionCount ?? 0}건
            </Text>
            <DisabledButton label="권한 매트릭스 (준비 중)" />
            <DisabledButton label="권한 부여하기 (준비 중)" />
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

function EmergencyRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.emRow}>
      <Text style={styles.emLabel}>{label}</Text>
      <Text style={styles.emValue}>{value?.trim() ? value : "정보 없음"}</Text>
    </View>
  );
}

function DisabledButton({ label }: { label: string }) {
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={label}
      style={styles.disabledBtn}
    >
      <Text style={styles.disabledBtnText}>{label}</Text>
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
  logout: { fontSize: 14, fontWeight: "600", color: PRIMARY[600] },
  emptyBox: { padding: SPACING.xl, alignItems: "center", backgroundColor: NEUTRAL.surface, borderRadius: RADIUS.md, marginTop: SPACING.lg },
  emptyText: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  slider: { gap: SPACING.md, paddingVertical: SPACING.lg },
  personCard: {
    width: 260,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  personCardSel: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  pcHead: { flexDirection: "row", gap: SPACING.md, alignItems: "center" },
  avatar: { fontSize: 40 },
  pcName: { fontSize: 18, fontWeight: "800", color: NEUTRAL.text },
  pcMeta: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 2 },
  adultTag: {
    alignSelf: "flex-start",
    marginTop: SPACING.sm,
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY[700],
    backgroundColor: PRIMARY[100],
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
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
  disabledBtn: {
    marginTop: SPACING.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.surface,
  },
  disabledBtnText: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textMuted },
});
