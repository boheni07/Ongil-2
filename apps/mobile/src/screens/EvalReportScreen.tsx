import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { evalReportSchema, type TherapyArea } from "@ongil/validation";
import {
  createEvalReport,
  getEvalComparison,
  getEvalComposeContext,
  type EvalComparison,
  type EvalComposeContext,
  type EvalType,
} from "../lib/eval";
import { getTherapistClients, type TherapistClient } from "../lib/therapy";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { CategoryChip } from "../components/IconSelector";
import { EvalComparisonTable } from "../components/EvalComparisonTable";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { Card } from "../components/Card";
import { DOMAIN_COLORS, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TherapistStackParamList } from "../navigation/types";

const MED = DOMAIN_COLORS.MED;

type Props = NativeStackScreenProps<TherapistStackParamList, "EvalReport">;

/** 4개 영역(§3 MED-007 domain enum) — 치료계획/회기일지 화면과 동일 라벨. */
const AREA_META: { key: TherapyArea; label: string; emoji: string }[] = [
  { key: "physical", label: "신체 (구강운동)", emoji: "🖐" },
  { key: "language", label: "언어", emoji: "💬" },
  { key: "cognitive", label: "인지", emoji: "🧠" },
  { key: "social", label: "사회성", emoji: "🤝" },
];

/** 평가 단계 3종(같은 계획서당 각 1건). */
const EVAL_TYPES: { key: EvalType; label: string }[] = [
  { key: "initial", label: "초기 평가" },
  { key: "interim", label: "중간 평가" },
  { key: "final", label: "최종 평가" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type Scores = Record<TherapyArea, string>;

function emptyScores(): Scores {
  return { physical: "", language: "", cognitive: "", social: "" };
}

/**
 * TH-17 평가보고서 작성 화면. 대상 아동 선택 → getEvalComposeContext로 최근 확정 치료계획서를
 * 자동 연결한다. 연결된 계획서(therapyPlanId)가 없으면 폼 대신 계획서 작성 안내로 대체한다.
 * 이미 제출된 eval_type은 선택 비활성화. 제출 성공 후 getEvalComparison으로 3열 비교 뷰를 갱신한다.
 * 델타는 getEvalComparison이 이미 계산해 오므로 화면에서 재계산하지 않는다.
 */
export function EvalReportScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params.personId;

  const [clients, setClients] = useState<TherapistClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId);
  const [personName, setPersonName] = useState(route.params.personName);
  const [ctx, setCtx] = useState<EvalComposeContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(Boolean(paramPersonId));
  const [comparison, setComparison] = useState<EvalComparison | null>(null);

  const [evalType, setEvalType] = useState<EvalType | null>(null);
  const [evalDate, setEvalDate] = useState(todayISO());
  const [scores, setScores] = useState<Scores>(emptyScores());
  const [summary, setSummary] = useState("");
  const [recommendations, setRecommendations] = useState("");

  const { loading, error, setError, run } = useAsyncAction();

  // 대상 미지정(홈 진입) — 아동 목록을 불러와 선택 UI를 노출한다.
  useEffect(() => {
    if (paramPersonId) return;
    void (async () => setClients(await getTherapistClients()))();
  }, [paramPersonId]);

  const loadContext = useCallback(async (pid: string) => {
    setCtxLoading(true);
    const c = await getEvalComposeContext(pid);
    setCtx(c);
    if (c.therapyPlanId) {
      setComparison(await getEvalComparison(c.therapyPlanId, pid));
    } else {
      setComparison(null);
    }
    setCtxLoading(false);
  }, []);

  useEffect(() => {
    if (personId) void loadContext(personId);
  }, [personId, loadContext]);

  const pickClient = (c: TherapistClient) => {
    setPersonId(c.personId);
    setPersonName(c.fullName);
  };

  const setScore = (area: TherapyArea, value: string) =>
    setScores((prev) => ({ ...prev, [area]: value.replace(/[^0-9]/g, "").slice(0, 3) }));

  const filledDomainScores = () =>
    AREA_META.map((a) => ({ domain: a.key, score: Number.parseInt(scores[a.key], 10) })).filter(
      (s) => !Number.isNaN(s.score)
    );

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(evalDate);
  const canSubmit =
    Boolean(ctx?.therapyPlanId) &&
    evalType !== null &&
    dateOk &&
    filledDomainScores().length > 0 &&
    summary.trim().length > 0 &&
    !loading;

  const submit = () =>
    run(async () => {
      if (!ctx?.therapyPlanId) return "연결된 치료계획서가 없습니다.";
      if (!evalType) return "평가 단계를 선택해주세요.";
      const input = {
        eval_type: evalType,
        eval_date: evalDate.trim(),
        therapy_plan_id: ctx.therapyPlanId,
        domain_scores: filledDomainScores(),
        summary: summary.trim(),
        recommendations: recommendations.trim() || undefined,
      };
      const parsed = evalReportSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createEvalReport(personId, parsed.data);
      if (res.error) return res.error;

      // 제출 성공 — 폼 초기화하고 비교 뷰를 갱신한다.
      setComparison(await getEvalComparison(ctx.therapyPlanId, personId));
      setCtx((prev) =>
        prev
          ? { ...prev, existingEvalTypes: [...new Set([...prev.existingEvalTypes, evalType])] }
          : prev
      );
      setEvalType(null);
      setScores(emptyScores());
      setSummary("");
      setRecommendations("");
    });

  // 대상 아동 미선택(홈 진입) — 선택 UI만 노출.
  if (!personId) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <Text style={styles.title}>평가보고서 작성</Text>
        <Text style={styles.sub}>평가를 기록할 아동을 선택하세요.</Text>
        {clients.length === 0 ? (
          <Text style={styles.muted}>담당 아동이 없습니다.</Text>
        ) : (
          <View style={styles.pickWrap}>
            {clients.map((c) => (
              <CategoryChip
                key={c.personId}
                emoji="🧒"
                label={c.fullName}
                selected={false}
                onPress={() => pickClient(c)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  if (ctxLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} />
      </View>
    );
  }

  // 연결된 치료계획서 없음 — 폼 대신 작성 안내로 대체한다.
  if (!ctx?.therapyPlanId) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <Text style={styles.title}>평가보고서 작성{personName ? ` · ${personName}` : ""}</Text>
        <View style={styles.noPlanBanner}>
          <Text style={styles.noPlanText}>
            먼저 치료계획서를 작성해주세요. 평가보고서는 확정된 치료계획서에 연결되어야 저장할 수 있습니다.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="치료계획서 작성하러 가기"
            onPress={() => navigation.replace("TherapyPlanWizard", { personId, personName })}
            style={({ pressed }) => [styles.noPlanBtn, pressed && styles.pressed]}
          >
            <Text style={styles.noPlanBtnText}>치료계획서 작성 →</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>평가보고서 작성{personName ? ` · ${personName}` : ""}</Text>
      <View style={styles.linkBanner}>
        <Text style={styles.linkBannerText}>🔗 치료계획서 자동 연결됨</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <Card>
      <Text style={styles.sectionTitle}>평가 단계</Text>
      <Text style={styles.helpText}>이미 제출된 단계는 선택할 수 없습니다(단계당 1건).</Text>
      <View style={styles.pickWrap}>
        {EVAL_TYPES.map((t) => {
          const done = ctx.existingEvalTypes.includes(t.key);
          const selected = evalType === t.key;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: done }}
              accessibilityLabel={`${t.label}${done ? ", 이미 제출됨" : ""}`}
              disabled={done}
              onPress={() => {
                setError(null);
                setEvalType(t.key);
              }}
              style={({ pressed }) => [
                styles.typeChip,
                selected && styles.typeChipSelected,
                done && styles.typeChipDone,
                pressed && !done && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.typeChipText,
                  selected && styles.typeChipTextSelected,
                  done && styles.typeChipTextDone,
                ]}
              >
                {t.label}
                {done ? " · 제출됨" : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>평가 일자</Text>
      <DateField
        accessibilityLabel="평가 일자. 예시 2026-07-14"
        value={evalDate}
        onChange={setEvalDate}
        style={styles.input}
      />

      </Card>

      <Card>
      <Text style={styles.sectionTitle}>영역별 점수 (0~100)</Text>
      <Text style={styles.helpText}>평가한 영역만 입력하세요(최소 1개).</Text>
      {AREA_META.map((a) => (
        <View key={a.key} style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>
            {a.emoji} {a.label}
          </Text>
          <TextInput
            accessibilityLabel={`${a.label} 점수`}
            value={scores[a.key]}
            onChangeText={(v) => setScore(a.key, v)}
            keyboardType="number-pad"
            placeholder="예: 72"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.scoreInput}
          />
        </View>
      ))}

      </Card>

      <Card>
      <Text style={styles.sectionTitle}>종합 평가 요약</Text>
      <TextInput
        accessibilityLabel="종합 평가 요약"
        value={summary}
        onChangeText={setSummary}
        placeholder="예: 언어 영역 뚜렷한 향상. 사회성 상호작용 시작 빈도 증가."
        placeholderTextColor={NEUTRAL.textMuted}
        multiline
        style={styles.textarea}
      />

      <Text style={styles.label}>권고사항 (선택)</Text>
      <TextInput
        accessibilityLabel="권고사항"
        value={recommendations}
        onChangeText={setRecommendations}
        placeholder="예: 가정 연계 활동 지속. 다음 분기 사회성 목표 상향 권장."
        placeholderTextColor={NEUTRAL.textMuted}
        multiline
        style={styles.textarea}
      />

      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="평가보고서 저장"
        accessibilityState={{ disabled: !canSubmit }}
        onPress={submit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.saveBtn,
          !canSubmit && styles.saveBtnDisabled,
          pressed && canSubmit && styles.pressed,
        ]}
      >
        <Text style={styles.saveBtnText}>{loading ? "저장 중…" : "평가보고서 저장"}</Text>
      </Pressable>

      <Card>
      <Text style={styles.sectionTitle}>평가 비교 (초기 · 중간 · 최종)</Text>
      {comparison && comparison.deltas.length > 0 ? (
        <EvalComparisonTable comparison={comparison} />
      ) : (
        <InfoBanner message="평가보고서를 제출하면 초기·중간·최종 점수 비교가 여기에 표시됩니다." />
      )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2, marginBottom: SPACING.md },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: SPACING.md },
  helpText: { fontSize: 13, color: NEUTRAL.textMuted, marginBottom: SPACING.sm },
  linkBanner: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: MED.bg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  linkBannerText: { fontSize: 14, fontWeight: "700", color: MED.text },
  noPlanBanner: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: "#FFF5E6",
    padding: SPACING.md,
  },
  noPlanText: { fontSize: 14, fontWeight: "600", color: "#B56F10", lineHeight: 20 },
  noPlanBtn: { marginTop: SPACING.sm, alignSelf: "flex-start" },
  noPlanBtnText: { fontSize: 14, fontWeight: "700", color: PRIMARY[700] },
  sectionTitle: {
    fontSize: FONT.h3,
    fontWeight: "700",
    color: NEUTRAL.text,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: NEUTRAL.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: NEUTRAL.text,
  },
  textarea: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: NEUTRAL.text,
    textAlignVertical: "top",
  },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xs },
  typeChip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.bg,
  },
  typeChipSelected: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  typeChipDone: { borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  typeChipText: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text },
  typeChipTextSelected: { color: PRIMARY[800] },
  typeChipTextDone: { color: NEUTRAL.textMuted },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.sm },
  scoreLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: NEUTRAL.text },
  scoreInput: {
    width: 96,
    minHeight: 48,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: NEUTRAL.text,
    textAlign: "center",
  },
  saveBtn: {
    marginTop: SPACING.xl,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
  },
  saveBtnDisabled: { backgroundColor: PRIMARY[400] },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  pressed: { opacity: 0.85 },
});
