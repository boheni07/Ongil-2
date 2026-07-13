import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TherapyPlanGoal, TherapyArea } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { getTherapyPlanDetail, updateTherapyPlanGoal, type TherapyPlanDetail } from "../lib/therapy";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ErrorBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TherapistStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TherapistStackParamList, "TherapyPlanDetail">;

const AREA_META: Record<TherapyArea, { label: string; emoji: string }> = {
  physical: { label: "신체 (구강운동)", emoji: "🖐" },
  language: { label: "언어", emoji: "💬" },
  cognitive: { label: "인지", emoji: "🧠" },
  social: { label: "사회성", emoji: "🤝" },
};

const THERAPY_TYPE_LABEL: Record<string, string> = {
  physical: "물리치료",
  occupational: "작업치료",
  speech: "언어치료",
  psychological: "심리치료",
  other: "기타",
};

const AREA_ORDER: TherapyArea[] = ["physical", "language", "cognitive", "social"];

interface EditState {
  area: TherapyArea;
  longTerm: string;
  shortTerm: string;
  targetScore: string;
}

function toEdit(g: TherapyPlanGoal): EditState {
  return {
    area: g.area,
    longTerm: g.long_term ?? "",
    shortTerm: g.short_term ?? "",
    targetScore: typeof g.target_score === "number" ? String(g.target_score) : "",
  };
}

/**
 * TH-14 치료계획서 상세 — 계획 정보 + 영역별 목표·달성도.
 * 달성도는 latestDomainScores[goal.area](최근 회기일지 domain_scores)를 목표의 area와 매칭한다.
 * 목표 탭 시 인라인 편집(직전 라운드 IspReview 아코디언 패턴 재사용).
 */
export function TherapyPlanDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { recordId } = route.params;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TherapyPlanDetail | null>(null);
  const [personName, setPersonName] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const { loading: saving, error, run } = useAsyncAction();

  const load = useCallback(async () => {
    const d = await getTherapyPlanDetail(recordId);
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
        <Text style={styles.muted}>치료계획서를 찾을 수 없거나 접근 권한이 없습니다.</Text>
      </View>
    );
  }

  const content = detail.content;
  const goals = Array.isArray(content.goals) ? content.goals : [];
  const pending = detail.requiresConfirmation && !detail.confirmedAt;
  const scores = detail.latestDomainScores;
  const typeLabel = THERAPY_TYPE_LABEL[content.therapy_type] ?? content.therapy_type;

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
        area?: TherapyArea;
        long_term?: string;
        short_term?: string;
        target_score?: number;
      } = { area: edit.area };
      if (edit.longTerm.trim()) patch.long_term = edit.longTerm.trim();
      if (edit.shortTerm.trim()) patch.short_term = edit.shortTerm.trim();
      if (edit.targetScore.trim()) {
        const n = Number.parseInt(edit.targetScore, 10);
        if (Number.isNaN(n) || n < 0 || n > 100) return "목표 점수는 0~100 사이 숫자여야 합니다.";
        patch.target_score = n;
      }
      const res = await updateTherapyPlanGoal(recordId, i, patch);
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
      <Text style={styles.title}>
        {typeLabel} 계획서{personName ? ` · ${personName}` : ""}
      </Text>
      <Text style={styles.sub}>{content.diagnosis}</Text>

      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, pending ? styles.statusPending : styles.statusOk]}>
          <Text style={[styles.statusText, pending ? styles.statusTextPending : styles.statusTextOk]}>
            {pending ? "확인 대기 중" : detail.confirmedAt ? "확인 완료" : "확인 불필요"}
          </Text>
        </View>
        <View style={styles.sessBadge}>
          <Text style={styles.sessBadgeText}>진행 {detail.sessionCount}회기</Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}
      {savedNote ? <Text style={styles.savedNote}>{savedNote}</Text> : null}

      <View style={styles.infoCard}>
        <InfoRow k="담당 치료사" v={content.responsible_therapist} />
        <InfoRow k="치료 기간" v={`${content.plan_period.start} ~ ${content.plan_period.end}`} />
        <InfoRow k="회기 빈도" v={content.session_frequency} />
        {content.precautions ? <InfoRow k="주의사항" v={content.precautions} /> : null}
      </View>

      <Text style={styles.sectionTitle}>영역별 목표 및 달성도</Text>
      {goals.length === 0 ? (
        <Text style={styles.muted}>등록된 목표가 없습니다.</Text>
      ) : (
        goals.map((g, i) => {
          const open = expanded === i;
          const meta = AREA_META[g.area];
          const score = scores ? scores[g.area] : null;
          const target = typeof g.target_score === "number" ? g.target_score : null;
          const alert = score != null && target != null && score < target * 0.6;
          return (
            <View key={i} style={styles.goalCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${meta?.label ?? g.area} 목표, 현재 달성도 ${
                  score != null ? `${score}%` : "미평가"
                }, ${open ? "접기" : "펼쳐 편집"}`}
                onPress={() => toggle(i)}
                style={({ pressed }) => [styles.goalHead, pressed && styles.pressed]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalArea}>
                    {meta?.emoji} {meta?.label ?? g.area}
                  </Text>
                  <Text style={styles.goalTitle} numberOfLines={open ? undefined : 1}>
                    {g.short_term || g.long_term || "목표 미입력"}
                  </Text>
                </View>
                <View style={styles.rateBox}>
                  <Text style={styles.rateText}>{score != null ? `${score}%` : "미평가"}</Text>
                </View>
              </Pressable>

              {score != null ? (
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, alert && styles.progressAlert, { width: `${score}%` }]}
                  />
                </View>
              ) : null}

              <Text style={styles.planPill}>
                목표: {target != null ? `${target}점` : g.long_term || "-"}
                {score != null ? ` · 현재 ${score}%` : ""}
                {alert ? "  ⚠️ 집중 필요" : ""}
              </Text>

              {open && edit ? (
                <View style={styles.editBox}>
                  <Text style={styles.label}>영역</Text>
                  <View style={styles.pickWrap}>
                    {AREA_ORDER.map((a) => {
                      const sel = edit.area === a;
                      return (
                        <Pressable
                          key={a}
                          accessibilityRole="button"
                          accessibilityState={{ selected: sel }}
                          accessibilityLabel={`${AREA_META[a].label} 영역`}
                          onPress={() => setEdit({ ...edit, area: a })}
                          style={({ pressed }) => [
                            styles.areaChip,
                            sel && styles.areaChipSel,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.areaChipText, sel && styles.areaChipTextSel]}>
                            {AREA_META[a].emoji} {AREA_META[a].label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
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
                  <Text style={styles.label}>목표 점수 (0~100)</Text>
                  <TextInput
                    accessibilityLabel="목표 점수"
                    value={edit.targetScore}
                    onChangeText={(v) =>
                      setEdit({ ...edit, targetScore: v.replace(/[^0-9]/g, "").slice(0, 3) })
                    }
                    keyboardType="number-pad"
                    placeholder="예: 80"
                    style={styles.input}
                    placeholderTextColor={NEUTRAL.textMuted}
                  />
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="회기 일지 작성"
        onPress={() =>
          navigation.navigate("SessionNoteForm", { personId: detail.personId, personName })
        }
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      >
        <Text style={styles.primaryBtnText}>＋ 회기 일지 작성</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="치료 타임라인 보기"
        onPress={() =>
          navigation.navigate("MedTimeline", { personId: detail.personId, personName })
        }
        style={({ pressed }) => [styles.timelineBtn, pressed && styles.pressed]}
      >
        <Text style={styles.timelineBtnText}>치료 타임라인 보기</Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoK}>{k}</Text>
      <Text style={styles.infoV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg, padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  statusBadge: { alignSelf: "flex-start", borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  statusPending: { backgroundColor: "#FFF5E6" },
  statusOk: { backgroundColor: PRIMARY[50] },
  statusText: { fontSize: 12, fontWeight: "700" },
  statusTextPending: { color: "#B56F10" },
  statusTextOk: { color: PRIMARY[700] },
  sessBadge: { borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: NEUTRAL.surface },
  sessBadgeText: { fontSize: 12, fontWeight: "700", color: NEUTRAL.text },
  savedNote: { fontSize: 13, color: PRIMARY[700], marginTop: SPACING.sm },
  infoCard: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    padding: SPACING.md,
  },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: SPACING.md },
  infoK: { fontSize: 13, color: NEUTRAL.textMuted },
  infoV: { fontSize: 13, fontWeight: "600", color: NEUTRAL.text, flex: 1, textAlign: "right" },
  sectionTitle: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  goalCard: { marginBottom: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: NEUTRAL.border, overflow: "hidden" },
  goalHead: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md },
  goalArea: { fontSize: 13, fontWeight: "700", color: PRIMARY[700] },
  goalTitle: { fontSize: 15, fontWeight: "600", color: NEUTRAL.text, marginTop: 2 },
  rateBox: { alignItems: "flex-end" },
  rateText: { fontSize: 14, fontWeight: "800", color: NEUTRAL.text },
  progressTrack: { height: 6, backgroundColor: NEUTRAL.surface },
  progressFill: { height: 6, backgroundColor: PRIMARY[600] },
  progressAlert: { backgroundColor: "#D9822B" },
  planPill: { fontSize: 12, color: NEUTRAL.textMuted, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  pressed: { opacity: 0.85 },
  editBox: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  label: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text, marginBottom: 6, marginTop: SPACING.sm },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  areaChip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.bg,
  },
  areaChipSel: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  areaChipText: { fontSize: 13, fontWeight: "600", color: NEUTRAL.text },
  areaChipTextSel: { color: PRIMARY[800] },
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
  primaryBtn: {
    marginTop: SPACING.xl,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  timelineBtn: {
    marginTop: SPACING.md,
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
