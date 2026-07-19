import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { IspGoal } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { getIspDetail, updateIspGoal, type IspDetail } from "../lib/isp";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ErrorBanner } from "../components/ui";
import { ACCENT, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "IspReview">;

interface EditState {
  area: string;
  longTerm: string;
  shortTerm: string;
  responsible: string;
  deadline: string;
  achievementRate: string;
}

function toEdit(g: IspGoal): EditState {
  return {
    area: g.area ?? "",
    longTerm: g.long_term ?? "",
    shortTerm: g.short_term ?? "",
    responsible: g.responsible ?? "",
    deadline: g.deadline ?? "",
    achievementRate: typeof g.achievement_rate === "number" ? String(g.achievement_rate) : "",
  };
}

/** 재사정 D-day가 0~30이면 D-30 경고 배지 노출(사용자 명시 요구사항). */
function isReassessmentSoon(dday: number | null): boolean {
  return dday != null && dday >= 0 && dday <= 30;
}

/**
 * W-14 ISP 점검 · 달성률 — 목표 리스트 아코디언(프로그레스바 + 재사정 D-30 배지).
 * 탭하면 인라인 편집 폼 노출(직전 라운드 IepReviewScreen 아코디언 패턴 재사용).
 */
export function IspReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { recordId } = route.params;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<IspDetail | null>(null);
  const [personName, setPersonName] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const { loading: saving, error, run } = useAsyncAction();

  const load = useCallback(async () => {
    const d = await getIspDetail(recordId);
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
        <Text style={styles.muted}>ISP를 찾을 수 없거나 접근 권한이 없습니다.</Text>
      </View>
    );
  }

  const goals = Array.isArray(detail.content.goals) ? detail.content.goals : [];
  const pending = detail.requiresConfirmation && !detail.confirmedAt;
  const reassessSoon = isReassessmentSoon(detail.reassessmentDday);

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
        long_term?: string;
        short_term?: string;
        responsible?: string;
        deadline?: string;
        achievement_rate?: number;
      } = {};
      if (edit.area.trim()) patch.area = edit.area.trim();
      if (edit.longTerm.trim()) patch.long_term = edit.longTerm.trim();
      if (edit.shortTerm.trim()) patch.short_term = edit.shortTerm.trim();
      if (edit.responsible.trim()) patch.responsible = edit.responsible.trim();
      if (edit.deadline.trim()) patch.deadline = edit.deadline.trim();
      if (edit.achievementRate.trim()) {
        const n = Number.parseInt(edit.achievementRate, 10);
        if (Number.isNaN(n) || n < 0 || n > 100) return "달성률은 0~100 사이 숫자여야 합니다.";
        patch.achievement_rate = n;
      }
      const res = await updateIspGoal(recordId, i, patch);
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
      <Text style={styles.title}>ISP 점검 · 달성률{personName ? ` · ${personName}` : ""}</Text>
      <Text style={styles.sub}>
        개인별지원계획 · 재사정 예정 {detail.content.reassessment_date}
      </Text>
      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, pending ? styles.statusPending : styles.statusOk]}>
          <Text style={[styles.statusText, pending ? styles.statusTextPending : styles.statusTextOk]}>
            {pending ? "확인 대기 중" : detail.confirmedAt ? "확인 완료" : "확인 불필요"}
          </Text>
        </View>
        {reassessSoon ? (
          <View style={styles.warnBadge}>
            <Text style={styles.warnBadgeText}>⚠️ 재사정 D-{detail.reassessmentDday}</Text>
          </View>
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {savedNote ? <Text style={styles.savedNote}>{savedNote}</Text> : null}

      <Text style={styles.sectionTitle}>목표 영역</Text>
      {goals.length === 0 ? (
        <Text style={styles.muted}>등록된 목표가 없습니다.</Text>
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
                    {g.long_term || g.short_term || "목표 미입력"}
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
                  <Text style={styles.label}>장기 목표</Text>
                  <TextInput
                    accessibilityLabel="장기 목표 편집"
                    value={edit.longTerm}
                    onChangeText={(v) => setEdit({ ...edit, longTerm: v })}
                    multiline
                    style={styles.textarea}
                    placeholderTextColor={NEUTRAL.textMuted}
                  />
                  <Text style={styles.label}>단기 목표</Text>
                  <TextInput
                    accessibilityLabel="단기 목표 편집"
                    value={edit.shortTerm}
                    onChangeText={(v) => setEdit({ ...edit, shortTerm: v })}
                    multiline
                    style={styles.textarea}
                    placeholderTextColor={NEUTRAL.textMuted}
                  />
                  <View style={styles.stRow}>
                    <View style={styles.stHalf}>
                      <Text style={styles.label}>담당</Text>
                      <TextInput
                        accessibilityLabel="담당 편집"
                        value={edit.responsible}
                        onChangeText={(v) => setEdit({ ...edit, responsible: v })}
                        style={styles.input}
                        placeholderTextColor={NEUTRAL.textMuted}
                      />
                    </View>
                    <View style={styles.stHalf}>
                      <Text style={styles.label}>기한</Text>
                      <TextInput
                        accessibilityLabel="기한 편집"
                        value={edit.deadline}
                        onChangeText={(v) => setEdit({ ...edit, deadline: v })}
                        placeholder="예: 2026-09"
                        style={styles.input}
                        placeholderTextColor={NEUTRAL.textMuted}
                      />
                    </View>
                  </View>
                  <Text style={styles.label}>달성률 (0~100)</Text>
                  <TextInput
                    accessibilityLabel="달성률"
                    value={edit.achievementRate}
                    onChangeText={(v) =>
                      setEdit({ ...edit, achievementRate: v.replace(/[^0-9]/g, "").slice(0, 3) })
                    }
                    keyboardType="number-pad"
                    placeholder="예: 60"
                    style={styles.input}
                    placeholderTextColor={NEUTRAL.textMuted}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="점검 기록 추가"
                    onPress={() => saveGoal(i)}
                    disabled={saving}
                    style={({ pressed }) => [
                      styles.saveBtn,
                      saving && styles.saveBtnDisabled,
                      pressed && !saving && styles.pressed,
                    ]}
                  >
                    <Text style={styles.saveBtnText}>{saving ? "저장 중…" : "점검 기록 추가"}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {/* 프로토타입 web-social-worker.html W-14의 "재사정 시작"(amber) — 새 ISP(재사정
          버전)를 작성하는 기존 화면으로 보낸다(웹과 동일한 결정, 별도 재사정 상태 불필요). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="재사정 시작"
        onPress={() => navigation.navigate("IspWizard", { personId: detail.personId, personName })}
        style={({ pressed }) => [styles.reassessBtn, pressed && styles.pressed]}
      >
        <Text style={styles.reassessBtnText}>🔄 재사정 시작</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="복지 타임라인 보기"
        onPress={() =>
          navigation.navigate("WelTimeline", { personId: detail.personId, personName })
        }
        style={({ pressed }) => [styles.timelineBtn, pressed && styles.pressed]}
      >
        <Text style={styles.timelineBtnText}>복지 타임라인 보기</Text>
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
  badgeRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPending: { backgroundColor: "#FFF5E6" },
  statusOk: { backgroundColor: PRIMARY[50] },
  statusText: { fontSize: 12, fontWeight: "700" },
  statusTextPending: { color: "#B56F10" },
  statusTextOk: { color: PRIMARY[700] },
  warnBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FFF5E6",
  },
  warnBadgeText: { fontSize: 12, fontWeight: "700", color: "#B56F10" },
  savedNote: { fontSize: 13, color: PRIMARY[700], marginTop: SPACING.sm },
  sectionTitle: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
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
  stRow: { flexDirection: "row", gap: SPACING.sm },
  stHalf: { flex: 1 },
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
  reassessBtn: {
    marginTop: SPACING.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: ACCENT.amber,
    backgroundColor: "#FFF8EC",
  },
  reassessBtnText: { fontSize: 16, fontWeight: "700", color: "#B56F10" },
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
