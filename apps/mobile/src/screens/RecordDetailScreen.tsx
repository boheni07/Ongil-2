import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { confirmRecord, getRecordDetail, type RecordDetail } from "../lib/records";
import { DomainChip } from "../components/DomainChip";
import { ErrorBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "RecordDetail">;

/** G-20 상세 — 확인 CTA + 구조화/범용 기록 분기 렌더. */
export function RecordDetailScreen({ route, navigation }: Props) {
  const { recordId, personId, personName } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDetail(await getRecordDetail(recordId));
    setLoading(false);
  }, [recordId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function handleConfirm() {
    if (!detail) return;
    setConfirmBusy(true);
    setError(null);
    const res = await confirmRecord(detail.id);
    setConfirmBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDetail({ ...detail, confirmedAt: new Date().toISOString() });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} />
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>기록을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const content = detail.content as Record<string, unknown> | null;
  const structuredEntries = Object.entries(content ?? {}).filter(([k]) => k !== "guardianNote");

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <View style={styles.headRow}>
        <DomainChip domain={detail.domain} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="기록 수정"
          onPress={() => navigation.navigate("RecordForm", { personId, personName, recordId: detail.id })}
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
        >
          <Text style={styles.editBtnText}>✎ 수정</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{detail.title}</Text>
      <Text style={styles.meta}>
        👤 작성자 {detail.authorName ?? "알 수 없음"} · 🗓 {detail.recordDate.slice(0, 10)}
      </Text>

      {detail.requiresConfirmation && !detail.confirmedAt && (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmText}>
            🔑 이 기록은 공식 문서로 확인이 필요합니다. 승인·반려가 아니라 내용을 확인했음을 남기는
            절차입니다.
          </Text>
          {error ? <ErrorBanner message={error} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="확인했습니다"
            onPress={() => void handleConfirm()}
            disabled={confirmBusy}
            style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
          >
            <Text style={styles.confirmBtnText}>{confirmBusy ? "처리 중..." : "확인했습니다"}</Text>
          </Pressable>
        </View>
      )}
      {detail.requiresConfirmation && detail.confirmedAt && (
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedText}>✓ 확인됨 · {detail.confirmedAt.slice(0, 10)}</Text>
        </View>
      )}

      {detail.isGuardianRecord ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>내용</Text>
          <Text style={styles.blockBody}>{(content?.body as string) ?? ""}</Text>
        </View>
      ) : (
        <>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>원본 기록 내용</Text>
            {structuredEntries.map(([k, v]) => (
              <View key={k} style={{ marginTop: SPACING.xs }}>
                <Text style={styles.fieldKey}>{k}</Text>
                <Text style={styles.blockBody}>{typeof v === "string" ? v : JSON.stringify(v)}</Text>
              </View>
            ))}
          </View>
          {detail.guardianNote && (
            <View style={[styles.block, styles.noteBlock]}>
              <Text style={styles.blockLabel}>보호자 메모</Text>
              <Text style={styles.noteTitle}>{detail.guardianNote.title}</Text>
              <Text style={styles.blockBody}>{detail.guardianNote.body}</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editBtn: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: { fontSize: 14, fontWeight: "700", color: NEUTRAL.text },
  pressed: { opacity: 0.85 },
  title: { marginTop: SPACING.sm, fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  meta: { marginTop: 4, fontSize: FONT.caption, color: NEUTRAL.textMuted },
  confirmBox: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: "#FFF5E6",
  },
  confirmText: { fontSize: FONT.body, color: NEUTRAL.text },
  confirmBtn: {
    marginTop: SPACING.md,
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  confirmedBadge: {
    marginTop: SPACING.lg,
    alignSelf: "flex-start",
    backgroundColor: PRIMARY[50],
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confirmedText: { fontSize: 12, fontWeight: "700", color: PRIMARY[700] },
  block: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: NEUTRAL.border },
  noteBlock: { backgroundColor: PRIMARY[50], borderWidth: 0 },
  blockLabel: { fontSize: FONT.label, fontWeight: "700", color: NEUTRAL.textMuted },
  blockBody: { marginTop: 4, fontSize: FONT.body, color: NEUTRAL.text },
  fieldKey: { fontSize: FONT.caption, fontWeight: "700", color: NEUTRAL.textMuted },
  noteTitle: { marginTop: 4, fontSize: FONT.body, fontWeight: "800", color: NEUTRAL.text },
});
