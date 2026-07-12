import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { IepAnnualGoal } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { getIepDetail, updateIepGoal, type IepDetail } from "../lib/iep";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { DomainChip } from "../components/DomainChip";
import { ErrorBanner } from "../components/ui";
import { formatShortDate } from "../lib/date";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TeacherStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TeacherStackParamList, "IepReview">;

interface EditState {
  area: string;
  goal: string;
  achievementRate: string;
  evaluationNote: string;
}

function toEdit(g: IepAnnualGoal): EditState {
  return {
    area: g.area ?? "",
    goal: g.goal ?? "",
    achievementRate: typeof g.achievement_rate === "number" ? String(g.achievement_rate) : "",
    evaluationNote: g.evaluation_note ?? "",
  };
}

/**
 * T-14 IEP 점검 — 모바일은 Split Pane 대신 목표 리스트 아코디언. 탭하면 인라인 편집 폼 노출.
 * "이전 버전 비교"·"관찰기록 연결" 섹션 포함.
 */
export function IepReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { recordId } = route.params;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<IepDetail | null>(null);
  const [personName, setPersonName] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const { loading: saving, error, run } = useAsyncAction();

  const load = useCallback(async () => {
    const d = await getIepDetail(recordId);
    setDetail(d);
    if (d) {
      const { data } = await supabase
        .from("persons")
        .select("full_name")
        .eq("id", d.personId)
        .maybeSingle();
      setPersonName((data?.full_name as string) ?? "");
    }
    setLoading(false);
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <Text style={styles.muted}>IEP를 찾을 수 없거나 접근 권한이 없습니다.</Text>
      </View>
    );
  }

  const goals = Array.isArray(detail.content.annual_goals) ? detail.content.annual_goals : [];
  const pending = detail.requiresConfirmation && !detail.confirmedAt;

  const toggle = (i: number) => {
    if (expanded === i) {
      setExpanded(null);
      setEdit(null);
      return;
    }
    setExpanded(i);
    setEdit(toEdit(goals[i]));
    setSavedNote(null);
  };

  const saveGoal = (i: number) =>
    run(async () => {
      if (!edit) return;
      const patch: {
        area?: string;
        goal?: string;
        achievement_rate?: number;
        evaluation_note?: string;
      } = {};
      if (edit.area.trim()) patch.area = edit.area.trim();
      if (edit.goal.trim()) patch.goal = edit.goal.trim();
      if (edit.achievementRate.trim()) {
        const n = Number.parseInt(edit.achievementRate, 10);
        if (Number.isNaN(n) || n < 0 || n > 100) return "달성률은 0~100 사이 숫자여야 합니다.";
        patch.achievement_rate = n;
      }
      if (edit.evaluationNote.trim()) patch.evaluation_note = edit.evaluationNote.trim();
      const res = await updateIepGoal(recordId, i, patch);
      if (res.error) return res.error;
      setSavedNote("변경 사항을 저장했습니다.");
      await load();
    });

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>IEP 점검{personName ? ` · ${personName}` : ""}</Text>
      <Text style={styles.sub}>
        {detail.content.school} · {detail.content.academic_year}학년도
      </Text>
      <View style={[styles.statusBadge, pending ? styles.statusPending : styles.statusOk]}>
        <Text style={[styles.statusText, pending ? styles.statusTextPending : styles.statusTextOk]}>
          {pending ? "확인 대기 중" : detail.confirmedAt ? "확인 완료" : "확인 불필요"}
        </Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {savedNote ? <Text style={styles.savedNote}>{savedNote}</Text> : null}

      <Text style={styles.sectionTitle}>IEP 목표 영역</Text>
      {goals.length === 0 ? (
        <Text style={styles.muted}>등록된 연간 목표가 없습니다.</Text>
      ) : (
        goals.map((g, i) => {
          const open = expanded === i;
          const rate = typeof g.achievement_rate === "number" ? g.achievement_rate : null;
          return (
            <View key={i} style={styles.goalCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${g.area || "영역 미지정"} 목표 ${open ? "접기" : "펼쳐 편집"}`}
                onPress={() => toggle(i)}
                style={({ pressed }) => [styles.goalHead, pressed && styles.pressed]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalArea}>{g.area || "영역 미지정"}</Text>
                  <Text style={styles.goalTitle} numberOfLines={open ? undefined : 1}>
                    {g.goal || "목표 미입력"}
                  </Text>
                </View>
                <View style={styles.rateBox}>
                  <Text style={styles.rateText}>{rate != null ? `${rate}%` : "미평가"}</Text>
                </View>
              </Pressable>

              {rate != null ? (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${rate}%` }]} />
                </View>
              ) : null}

              {open && edit ? (
                <View style={styles.editBox}>
                  <Text style={styles.label}>영역</Text>
                  <TextInput
                    accessibilityLabel="목표 영역 편집"
                    value={edit.area}
                    onChangeText={(v) => setEdit({ ...edit, area: v })}
                    style={styles.input}
                    placeholderTextColor={NEUTRAL.textMuted}
                  />
                  <Text style={styles.label}>연간 목표</Text>
                  <TextInput
                    accessibilityLabel="연간 목표 편집"
                    value={edit.goal}
                    onChangeText={(v) => setEdit({ ...edit, goal: v })}
                    multiline
                    style={styles.textarea}
                    placeholderTextColor={NEUTRAL.textMuted}
                  />
                  <Text style={styles.label}>달성률 (0~100)</Text>
                  <TextInput
                    accessibilityLabel="달성률"
                    value={edit.achievementRate}
                    onChangeText={(v) =>
                      setEdit({ ...edit, achievementRate: v.replace(/[^0-9]/g, "").slice(0, 3) })
                    }
                    keyboardType="number-pad"
                    placeholder="예: 65"
                    style={styles.input}
                    placeholderTextColor={NEUTRAL.textMuted}
                  />
                  <Text style={styles.label}>평가 메모</Text>
                  <TextInput
                    accessibilityLabel="평가 메모"
                    value={edit.evaluationNote}
                    onChangeText={(v) => setEdit({ ...edit, evaluationNote: v })}
                    multiline
                    placeholder="진행 상황·평가 내용"
                    style={styles.textarea}
                    placeholderTextColor={NEUTRAL.textMuted}
                  />
                  {g.short_term_goals && g.short_term_goals.length > 0 ? (
                    <View style={styles.stList}>
                      <Text style={styles.stListTitle}>단기 목표</Text>
                      {g.short_term_goals.map((st, si) => (
                        <Text key={si} style={styles.stItem}>
                          • {st.goal}
                          {st.period ? ` (${st.period})` : ""}
                          {st.evaluation ? ` · ${st.evaluation}` : ""}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="변경 저장"
                    onPress={() => saveGoal(i)}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.saveBtn,
                      saving && styles.saveBtnDisabled,
                      pressed && !saving && styles.pressed,
                    ]}
                  >
                    <Text style={styles.saveBtnText}>{saving ? "저장 중…" : "변경 저장"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitle}>이전 버전 비교</Text>
      {detail.previousVersion ? (
        <View style={styles.diffCard}>
          <View style={styles.diffCol}>
            <Text style={styles.diffHead}>{detail.previousVersion.academicYear}학년도 (이전)</Text>
            <Text style={styles.diffBody}>
              연간 목표 {detail.previousVersion.content.annual_goals?.length ?? 0}개
            </Text>
          </View>
          <View style={styles.diffCol}>
            <Text style={styles.diffHead}>{detail.content.academic_year}학년도 (현재)</Text>
            <Text style={styles.diffBody}>연간 목표 {goals.length}개</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.muted}>비교할 이전 학년도 IEP가 없습니다.</Text>
      )}

      <View style={styles.obsHeader}>
        <Text style={styles.sectionTitleInline}>관찰기록 연결</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 관찰기록 작성"
          onPress={() =>
            navigation.navigate("ObservationForm", {
              personId: detail.personId,
              personName,
            })
          }
          hitSlop={6}
        >
          <Text style={styles.obsAdd}>＋ 관찰기록</Text>
        </Pressable>
      </View>
      {detail.linkedObservations.length === 0 ? (
        <Text style={styles.muted}>연결된 관찰기록이 없습니다.</Text>
      ) : (
        detail.linkedObservations.map((o) => (
          <View key={o.recordId} style={styles.obsRow}>
            <DomainChip domain="EDU" />
            <View style={{ flex: 1 }}>
              <Text style={styles.obsSituation} numberOfLines={2}>
                {o.situation}
              </Text>
              <Text style={styles.obsMeta}>
                {o.observedAt ? formatShortDate(o.observedAt) : ""}
                {o.tags.length ? ` · ${o.tags.slice(0, 3).join(", ")}` : ""}
              </Text>
            </View>
          </View>
        ))
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="교육 타임라인 보기"
        onPress={() =>
          navigation.navigate("EduTimeline", { personId: detail.personId, personName })
        }
        style={({ pressed }) => [styles.timelineBtn, pressed && styles.pressed]}
      >
        <Text style={styles.timelineBtnText}>교육 타임라인 보기</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg, padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: SPACING.sm,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPending: { backgroundColor: "#FFF5E6" },
  statusOk: { backgroundColor: PRIMARY[50] },
  statusText: { fontSize: 12, fontWeight: "700" },
  statusTextPending: { color: "#B56F10" },
  statusTextOk: { color: PRIMARY[700] },
  savedNote: { fontSize: 13, color: PRIMARY[700], marginTop: SPACING.sm },
  sectionTitle: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  sectionTitleInline: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  goalCard: {
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    overflow: "hidden",
  },
  goalHead: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md },
  goalArea: { fontSize: 13, fontWeight: "700", color: PRIMARY[700] },
  goalTitle: { fontSize: 15, fontWeight: "600", color: NEUTRAL.text, marginTop: 2 },
  rateBox: { alignItems: "flex-end" },
  rateText: { fontSize: 14, fontWeight: "800", color: NEUTRAL.text },
  progressTrack: { height: 6, backgroundColor: NEUTRAL.surface },
  progressFill: { height: 6, backgroundColor: PRIMARY[600] },
  pressed: { opacity: 0.85 },
  editBox: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  label: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 15,
    color: NEUTRAL.text,
    backgroundColor: NEUTRAL.bg,
  },
  textarea: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: NEUTRAL.text,
    textAlignVertical: "top",
    backgroundColor: NEUTRAL.bg,
  },
  stList: { marginTop: SPACING.md },
  stListTitle: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textMuted, marginBottom: 4 },
  stItem: { fontSize: 13, color: NEUTRAL.text, marginBottom: 2 },
  saveBtn: {
    marginTop: SPACING.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
  },
  saveBtnDisabled: { backgroundColor: PRIMARY[400] },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  diffCard: { flexDirection: "row", gap: SPACING.md },
  diffCol: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },
  diffHead: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textMuted, marginBottom: 4 },
  diffBody: { fontSize: 14, color: NEUTRAL.text },
  obsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  obsAdd: { fontSize: 14, fontWeight: "700", color: PRIMARY[700] },
  obsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  obsSituation: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text },
  obsMeta: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: 2 },
  timelineBtn: {
    marginTop: SPACING.xl,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    backgroundColor: PRIMARY[50],
  },
  timelineBtnText: { fontSize: 16, fontWeight: "700", color: PRIMARY[700] },
});
