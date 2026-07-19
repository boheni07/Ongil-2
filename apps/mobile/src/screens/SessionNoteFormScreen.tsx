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
import {
  sessionNoteSchema,
  type TherapyArea,
  type TherapyDomainScores,
} from "@ongil/validation";
import {
  createSessionNote,
  getSessionComposeContext,
  getTherapistClients,
  type SessionComposeContext,
  type TherapistClient,
} from "../lib/therapy";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { CategoryChip } from "../components/IconSelector";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TherapistStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TherapistStackParamList, "SessionNoteForm">;

const AREA_META: { key: TherapyArea; label: string; emoji: string }[] = [
  { key: "physical", label: "신체 (구강운동)", emoji: "🖐" },
  { key: "language", label: "언어", emoji: "💬" },
  { key: "cognitive", label: "인지", emoji: "🧠" },
  { key: "social", label: "사회성", emoji: "🤝" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * TH-15 회기 일지 작성 — 진입 시 getSessionComposeContext(personId)로 최근 확정 치료계획서를
 * 자동 연결(배너)하고, 계획 vs 실제 비교 패널(좌 계획 목표 / 우 실제 진행)과 4개 영역 달성도
 * 슬라이더(0~100)를 제공한다. 슬라이더가 없는 환경이라 접근성 role="adjustable" 스텝퍼로 구현한다.
 * 대상 아동 파라미터가 없으면(홈 상단 버튼) 화면 내에서 먼저 선택한다.
 */
export function SessionNoteFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params.personId;

  const [clients, setClients] = useState<TherapistClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId);
  const [personName, setPersonName] = useState(route.params.personName);
  const [ctx, setCtx] = useState<SessionComposeContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(Boolean(paramPersonId));

  const [sessionDate, setSessionDate] = useState(todayISO());
  const [actualProgress, setActualProgress] = useState("");
  const [observations, setObservations] = useState("");
  const [nextSessionPlan, setNextSessionPlan] = useState("");
  const [scores, setScores] = useState<TherapyDomainScores>({
    physical: 50,
    language: 50,
    cognitive: 50,
    social: 50,
  });

  const { loading, error, run } = useAsyncAction();

  // 대상 미지정(홈 상단 버튼)일 때만 아동 목록을 불러와 선택 UI를 노출한다.
  useEffect(() => {
    if (paramPersonId) return;
    void (async () => setClients(await getTherapistClients()))();
  }, [paramPersonId]);

  // personId가 정해지면 자동연결 컨텍스트를 조회한다(직전 회기 달성도로 슬라이더 초기화).
  const loadContext = useCallback(async (pid: string) => {
    setCtxLoading(true);
    const c = await getSessionComposeContext(pid);
    setCtx(c);
    if (c.previousSession) setScores(c.previousSession.domainScores);
    setCtxLoading(false);
  }, []);

  useEffect(() => {
    if (personId) void loadContext(personId);
  }, [personId, loadContext]);

  const pickClient = (c: TherapistClient) => {
    setPersonId(c.personId);
    setPersonName(c.fullName);
  };

  const setScore = (area: TherapyArea, value: number) =>
    setScores((prev) => ({ ...prev, [area]: clamp(value) }));

  const plannedGoals = ctx
    ? ctx.planGoals
        .map((g) => g.short_term || g.long_term)
        .filter((s): s is string => Boolean(s && s.trim()))
    : [];

  const canSubmit =
    Boolean(personId) &&
    Boolean(ctx?.therapyPlanId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(sessionDate) &&
    actualProgress.trim().length > 0 &&
    observations.trim().length > 0;

  const submit = () =>
    run(async () => {
      if (!ctx?.therapyPlanId) return "연결된 치료계획서가 없습니다.";
      const input = {
        personId,
        session_date: sessionDate.trim(),
        therapy_plan_id: ctx.therapyPlanId,
        session_number: ctx.sessionNumber,
        planned_goals: plannedGoals,
        actual_progress: actualProgress.trim(),
        domain_scores: scores,
        observations: observations.trim(),
        next_session_plan: nextSessionPlan.trim() || undefined,
      };
      const parsed = sessionNoteSchema.safeParse((({ personId: _pid, ...rest }) => rest)(input));
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createSessionNote(input);
      if (res.error) return res.error;
      navigation.goBack();
    });

  // 대상 아동을 아직 고르지 않은 경우(홈 상단 버튼 진입) — 선택 UI만 노출.
  if (!personId) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <Text style={styles.title}>회기 일지 작성</Text>
        <Text style={styles.sub}>회기를 기록할 아동을 선택하세요.</Text>
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

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>회기 일지 작성{personName ? ` · ${personName}` : ""}</Text>
      {ctxLoading ? (
        <ActivityIndicator color={PRIMARY[600]} style={{ marginTop: SPACING.lg }} />
      ) : (
        <>
          {/* 치료계획 자동연결 배너 */}
          {ctx?.therapyPlanId ? (
            <View style={styles.linkBanner}>
              <Text style={styles.linkBannerText}>
                🔗 계획서 자동 연결됨 · {ctx.sessionNumber}회기차
              </Text>
            </View>
          ) : (
            <View style={styles.noPlanBanner}>
              <Text style={styles.noPlanText}>
                연결된 치료계획서가 없습니다. 먼저 치료계획서를 작성해야 회기 일지를 저장할 수 있습니다.
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
          )}

          {error ? <ErrorBanner message={error} /> : null}

          <Text style={styles.label}>회기 일자</Text>
          <DateField
            accessibilityLabel="회기 일자. 예시 2026-07-08"
            value={sessionDate}
            onChange={setSessionDate}
            style={styles.input}
          />

          <Text style={styles.sectionTitle}>회기 활동 기록</Text>
          <Text style={styles.label}>주요 활동 · 실제 진행 내용</Text>
          <TextInput
            accessibilityLabel="주요 활동 및 실제 진행 내용"
            value={actualProgress}
            onChangeText={setActualProgress}
            placeholder="예: 그림카드를 활용한 2어절 표현 유도. 자발 산출 8회 관찰."
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>아동 반응 · 관찰 내용</Text>
          <TextInput
            accessibilityLabel="아동 반응 및 관찰 내용"
            value={observations}
            onChangeText={setObservations}
            placeholder="예: 후반부 집중 저하. 짧은 세션 반복 시 참여도 회복."
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />

          {/* 계획 vs 실제 비교 */}
          <Text style={styles.sectionTitle}>계획 vs 실제 비교</Text>
          <View style={styles.cmpRow}>
            <View style={[styles.cmpBox, styles.cmpPlan]}>
              <Text style={styles.cmpHead}>계획 (목표)</Text>
              {plannedGoals.length === 0 ? (
                <Text style={styles.cmpMuted}>연결된 계획 목표 없음</Text>
              ) : (
                plannedGoals.map((g, i) => (
                  <Text key={i} style={styles.cmpItem}>
                    • {g}
                  </Text>
                ))
              )}
            </View>
            <View style={[styles.cmpBox, styles.cmpReal]}>
              <Text style={styles.cmpHead}>실제 (오늘)</Text>
              <Text style={styles.cmpRealText}>
                {actualProgress.trim() ? actualProgress.trim() : "위의 실제 진행 내용이 여기에 반영됩니다."}
              </Text>
            </View>
          </View>
          {ctx?.previousSession ? (
            <Text style={styles.prevNote}>
              직전 회기 진행: {ctx.previousSession.actualProgress || "기록 없음"}
            </Text>
          ) : null}

          {/* 영역별 달성도 슬라이더 */}
          <Text style={styles.sectionTitle}>영역별 달성도 체크</Text>
          {AREA_META.map((a) => (
            <ScoreSlider
              key={a.key}
              emoji={a.emoji}
              label={a.label}
              value={scores[a.key]}
              onChange={(v) => setScore(a.key, v)}
            />
          ))}

          <Text style={styles.sectionTitle}>다음 회기 계획 (선택)</Text>
          <TextInput
            accessibilityLabel="다음 회기 계획"
            value={nextSessionPlan}
            onChangeText={setNextSessionPlan}
            placeholder="예: 3어절 표현 확장, 범주화 5종 목표 유지"
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />

          {!ctx?.therapyPlanId ? (
            <InfoBanner message="치료계획서를 먼저 작성하면 회기 일지를 저장할 수 있습니다." />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="회기 일지 저장"
            accessibilityState={{ disabled: !canSubmit || loading }}
            onPress={submit}
            disabled={!canSubmit || loading}
            style={({ pressed }) => [
              styles.saveBtn,
              (!canSubmit || loading) && styles.saveBtnDisabled,
              pressed && canSubmit && !loading && styles.pressed,
            ]}
          >
            <Text style={styles.saveBtnText}>{loading ? "저장 중…" : "회기 일지 저장"}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

/**
 * 달성도 슬라이더 대체 컨트롤 — @react-native-community/slider 미설치 환경에서
 * 접근성 role="adjustable" 스텝퍼(±5)로 0~100 값을 조절한다. 현재값을 항상 표시한다.
 */
function ScoreSlider({
  emoji,
  label,
  value,
  onChange,
}: {
  emoji: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHead}>
        <Text style={styles.sliderLabel}>
          {emoji} {label}
        </Text>
        <Text style={styles.sliderValue}>{value}%</Text>
      </View>
      <View style={styles.sliderControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 달성도 5 감소`}
          onPress={() => onChange(value - 5)}
          hitSlop={8}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View
          style={styles.sliderTrack}
          accessibilityRole="adjustable"
          accessibilityLabel={`${label} 달성도`}
          accessibilityValue={{ min: 0, max: 100, now: value }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "increment") onChange(value + 5);
            else if (e.nativeEvent.actionName === "decrement") onChange(value - 5);
          }}
        >
          <View style={[styles.sliderFill, { width: `${value}%` }]} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 달성도 5 증가`}
          onPress={() => onChange(value + 5)}
          hitSlop={8}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
        >
          <Text style={styles.stepBtnText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2, marginBottom: SPACING.md },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: SPACING.md },
  linkBanner: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[50],
    padding: SPACING.md,
  },
  linkBannerText: { fontSize: 14, fontWeight: "700", color: PRIMARY[700] },
  noPlanBanner: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: "#FFF5E6",
    padding: SPACING.md,
  },
  noPlanText: { fontSize: 14, fontWeight: "600", color: "#B56F10", lineHeight: 20 },
  noPlanBtn: { marginTop: SPACING.sm, alignSelf: "flex-start" },
  noPlanBtnText: { fontSize: 14, fontWeight: "700", color: PRIMARY[700] },
  label: { fontSize: 15, fontWeight: "600", color: NEUTRAL.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
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
  sectionTitle: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.md },
  cmpRow: { flexDirection: "row", gap: SPACING.sm },
  cmpBox: { flex: 1, borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.md },
  cmpPlan: { borderColor: PRIMARY[400], backgroundColor: PRIMARY[50] },
  cmpReal: { borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  cmpHead: { fontSize: 13, fontWeight: "800", color: NEUTRAL.text, marginBottom: SPACING.sm },
  cmpItem: { fontSize: 13, color: NEUTRAL.text, lineHeight: 20 },
  cmpMuted: { fontSize: 13, color: NEUTRAL.textMuted },
  cmpRealText: { fontSize: 13, color: NEUTRAL.text, lineHeight: 20 },
  prevNote: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: SPACING.sm, fontStyle: "italic" },
  sliderRow: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },
  sliderHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sliderLabel: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text },
  sliderValue: { fontSize: 16, fontWeight: "800", color: PRIMARY[700] },
  sliderControls: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: SPACING.sm },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    backgroundColor: NEUTRAL.bg,
  },
  stepBtnText: { fontSize: 22, fontWeight: "800", color: PRIMARY[700] },
  sliderTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: NEUTRAL.border, overflow: "hidden" },
  sliderFill: { height: 10, backgroundColor: PRIMARY[600] },
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
