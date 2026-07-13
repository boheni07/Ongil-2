import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { therapyPlanSchema, type TherapyArea } from "@ongil/validation";
import { createTherapyPlan, getTherapistClients, type TherapistClient } from "../lib/therapy";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StepBar } from "../components/StepBar";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TherapistStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TherapistStackParamList, "TherapyPlanWizard">;

/** 치료 유형 셀렉트(§3 MED-005 therapy_type enum). */
const THERAPY_TYPES: { key: "physical" | "occupational" | "speech" | "psychological" | "other"; label: string; emoji: string }[] = [
  { key: "physical", label: "물리치료", emoji: "🖐" },
  { key: "occupational", label: "작업치료", emoji: "✋" },
  { key: "speech", label: "언어치료", emoji: "💬" },
  { key: "psychological", label: "심리치료", emoji: "🧠" },
  { key: "other", label: "기타", emoji: "🩺" },
];

/** 치료 목표 4영역(§3 MED-005 goals[].area enum) — 고정 4목표로 렌더한다(프로토타입 TH-13 Step3). */
const AREAS: { key: TherapyArea; label: string; emoji: string }[] = [
  { key: "physical", label: "신체 (구강운동)", emoji: "🖐" },
  { key: "language", label: "언어", emoji: "💬" },
  { key: "cognitive", label: "인지", emoji: "🧠" },
  { key: "social", label: "사회성", emoji: "🤝" },
];

interface AreaGoal {
  longTerm: string;
  shortTerm: string;
  targetScore: string;
}

interface Draft {
  personId: string;
  diagnosis: string;
  therapyType: string;
  responsibleTherapist: string;
  periodStart: string;
  periodEnd: string;
  precautions: string;
  sessionFrequency: string;
  goals: Record<TherapyArea, AreaGoal>;
}

const STEP_CAPS: Record<number, string> = {
  1: "기본 정보",
  2: "초기 평가",
  3: "치료 목표",
  4: "회기 계획",
  5: "확인 · 제출",
};

const TOTAL_STEPS = 5;

function emptyGoals(): Record<TherapyArea, AreaGoal> {
  return {
    physical: { longTerm: "", shortTerm: "", targetScore: "" },
    language: { longTerm: "", shortTerm: "", targetScore: "" },
    cognitive: { longTerm: "", shortTerm: "", targetScore: "" },
    social: { longTerm: "", shortTerm: "", targetScore: "" },
  };
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoPlusMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** TH-13 치료계획서 작성 5단계 위저드. 대상 아동 파라미터가 없으면 1단계에서 화면 내 선택. */
export function TherapyPlanWizardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params.personId;

  const [clients, setClients] = useState<TherapistClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId);
  const [diagnosis, setDiagnosis] = useState("");
  const [therapyType, setTherapyType] = useState("speech");
  const [responsibleTherapist, setResponsibleTherapist] = useState("");
  const [periodStart, setPeriodStart] = useState(todayISO());
  const [periodEnd, setPeriodEnd] = useState(isoPlusMonths(3));
  const [precautions, setPrecautions] = useState("");
  const [sessionFrequency, setSessionFrequency] = useState("");
  const [goals, setGoals] = useState<Record<TherapyArea, AreaGoal>>(emptyGoals());

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>("therapyPlan:draft");

  const selectedClient = clients.find((c) => c.personId === personId) ?? null;
  const [step, setStep] = useState(1);

  const snapshot = useCallback(
    (): Draft => ({
      personId,
      diagnosis,
      therapyType,
      responsibleTherapist,
      periodStart,
      periodEnd,
      precautions,
      sessionFrequency,
      goals,
    }),
    [personId, diagnosis, therapyType, responsibleTherapist, periodStart, periodEnd, precautions, sessionFrequency, goals]
  );

  const applyDraft = useCallback((d: Draft) => {
    setPersonId(d.personId);
    setDiagnosis(d.diagnosis);
    setTherapyType(d.therapyType || "speech");
    setResponsibleTherapist(d.responsibleTherapist);
    setPeriodStart(d.periodStart);
    setPeriodEnd(d.periodEnd);
    setPrecautions(d.precautions);
    setSessionFrequency(d.sessionFrequency);
    setGoals(d.goals ?? emptyGoals());
  }, []);

  useEffect(() => {
    void (async () => {
      setClients(await getTherapistClients());
      await checkRestore(applyDraft);
    })();
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [step, saveDraft, snapshot]);

  const updateGoal = (area: TherapyArea, patch: Partial<AreaGoal>) =>
    setGoals((prev) => ({ ...prev, [area]: { ...prev[area], ...patch } }));

  const filledGoals = () =>
    AREAS.map((a) => ({ area: a.key, ...goals[a.key] })).filter(
      (g) => g.longTerm.trim() || g.shortTerm.trim()
    );

  const buildInput = () => ({
    personId,
    plan_period: { start: periodStart.trim(), end: periodEnd.trim() },
    diagnosis: diagnosis.trim(),
    therapy_type: therapyType as "physical" | "occupational" | "speech" | "psychological" | "other",
    goals: filledGoals().map((g) => {
      const score = Number.parseInt(g.targetScore, 10);
      return {
        area: g.area,
        long_term: g.longTerm.trim(),
        short_term: g.shortTerm.trim(),
        ...(Number.isNaN(score) ? {} : { target_score: score }),
      };
    }),
    session_frequency: sessionFrequency.trim(),
    responsible_therapist: responsibleTherapist.trim(),
    precautions: precautions.trim() || undefined,
  });

  const dateOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const canNext =
    (step === 1 &&
      Boolean(personId) &&
      diagnosis.trim() &&
      responsibleTherapist.trim() &&
      dateOk(periodStart) &&
      dateOk(periodEnd)) ||
    step === 2 ||
    (step === 3 && filledGoals().length > 0) ||
    (step === 4 && sessionFrequency.trim().length > 0) ||
    step === 5;

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => {
    if (step === 1) navigation.goBack();
    else setStep((s) => s - 1);
  };

  const submit = () =>
    run(async () => {
      const input = buildInput();
      const parsed = therapyPlanSchema.safeParse((({ personId: _pid, ...rest }) => rest)(input));
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createTherapyPlan(input);
      if (res.error) return res.error;
      clearDraft();
      if (res.recordId) navigation.replace("TherapyPlanDetail", { recordId: res.recordId });
      else navigation.goBack();
    });

  const isLast = step === TOTAL_STEPS;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepBar current={step} total={TOTAL_STEPS} label="치료계획서 작성" />
      <Text style={styles.stepCap}>
        {step}/{TOTAL_STEPS} · {STEP_CAPS[step]}
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      {step === 1 && (
        <View>
          {!paramPersonId ? (
            <>
              <Text style={styles.label}>대상 아동</Text>
              {clients.length === 0 ? (
                <Text style={styles.muted}>담당 아동이 없습니다.</Text>
              ) : (
                <View style={styles.pickWrap}>
                  {clients.map((c) => (
                    <CategoryChip
                      key={c.personId}
                      emoji="🧒"
                      label={c.fullName}
                      selected={personId === c.personId}
                      onPress={() => setPersonId(c.personId)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.clientBanner}>대상 아동: {route.params.personName}</Text>
          )}
          <Text style={styles.label}>진단명</Text>
          <TextInput
            accessibilityLabel="진단명"
            value={diagnosis}
            onChangeText={setDiagnosis}
            placeholder="예: 표현·수용 언어 발달지연"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>치료 유형</Text>
          <View style={styles.pickWrap}>
            {THERAPY_TYPES.map((t) => (
              <CategoryChip
                key={t.key}
                emoji={t.emoji}
                label={t.label}
                selected={therapyType === t.key}
                onPress={() => setTherapyType(t.key)}
              />
            ))}
          </View>
          <Text style={styles.label}>담당 치료사</Text>
          <TextInput
            accessibilityLabel="담당 치료사"
            value={responsibleTherapist}
            onChangeText={setResponsibleTherapist}
            placeholder="예: 박서연 언어치료사"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>치료 시작일</Text>
          <TextInput
            accessibilityLabel="치료 시작일. 예시 2026-07-08"
            value={periodStart}
            onChangeText={setPeriodStart}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>치료 종료일</Text>
          <TextInput
            accessibilityLabel="치료 종료일. 예시 2026-10-08"
            value={periodEnd}
            onChangeText={setPeriodEnd}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.helpText}>
            초기 평가 소견과 치료 진행 시 주의사항을 기록하세요. (선택)
          </Text>
          <Text style={styles.label}>초기 평가 소견 · 주의사항</Text>
          <TextInput
            accessibilityLabel="초기 평가 소견 및 주의사항"
            value={precautions}
            onChangeText={setPrecautions}
            placeholder="예: 후반부 집중 저하 경향. 짧은 세션 반복 권장."
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.helpText}>
            영역별 장·단기 목표를 설정하세요. 목표가 있는 영역만 저장됩니다(최소 1개).
          </Text>
          {AREAS.map((a) => {
            const g = goals[a.key];
            return (
              <View key={a.key} style={styles.goalCard}>
                <Text style={styles.goalNum}>
                  {a.emoji} {a.label}
                  {a.key === "language" ? "  · 핵심" : ""}
                </Text>
                <Text style={styles.label}>장기 목표</Text>
                <TextInput
                  accessibilityLabel={`${a.label} 장기 목표`}
                  value={g.longTerm}
                  onChangeText={(v) => updateGoal(a.key, { longTerm: v })}
                  placeholder="예: 조음 정확도 60%→80% 달성"
                  placeholderTextColor={NEUTRAL.textMuted}
                  multiline
                  style={styles.textarea}
                />
                <Text style={styles.label}>단기 목표</Text>
                <TextInput
                  accessibilityLabel={`${a.label} 단기 목표`}
                  value={g.shortTerm}
                  onChangeText={(v) => updateGoal(a.key, { shortTerm: v })}
                  placeholder="예: 2어절 표현 자발 산출 회기당 10회"
                  placeholderTextColor={NEUTRAL.textMuted}
                  multiline
                  style={styles.textarea}
                />
                <Text style={styles.label}>목표 점수 (0~100, 선택)</Text>
                <TextInput
                  accessibilityLabel={`${a.label} 목표 점수`}
                  value={g.targetScore}
                  onChangeText={(v) =>
                    updateGoal(a.key, { targetScore: v.replace(/[^0-9]/g, "").slice(0, 3) })
                  }
                  keyboardType="number-pad"
                  placeholder="예: 80"
                  placeholderTextColor={NEUTRAL.textMuted}
                  style={styles.input}
                />
              </View>
            );
          })}
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={styles.helpText}>회기 진행 빈도를 입력하세요.</Text>
          <Text style={styles.label}>회기 빈도</Text>
          <TextInput
            accessibilityLabel="회기 빈도"
            value={sessionFrequency}
            onChangeText={setSessionFrequency}
            placeholder="예: 주 2회 (총 24회기)"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
        </View>
      )}

      {step === 5 && (
        <View>
          <Text style={styles.helpText}>입력 내용을 확인하고 제출하세요.</Text>
          <View style={styles.summary}>
            <SumRow k="대상 아동" v={selectedClient?.fullName || route.params.personName || "-"} />
            <SumRow k="진단명" v={diagnosis || "-"} />
            <SumRow
              k="치료 유형"
              v={THERAPY_TYPES.find((t) => t.key === therapyType)?.label ?? "-"}
            />
            <SumRow k="담당 치료사" v={responsibleTherapist || "-"} />
            <SumRow k="치료 기간" v={`${periodStart} ~ ${periodEnd}`} />
            <SumRow k="회기 빈도" v={sessionFrequency || "-"} />
            <SumRow k="치료 목표" v={`${filledGoals().length}개 영역`} />
          </View>
          <InfoBanner message="치료계획서는 공식 문서입니다. 제출 시 당사자·보호자 확인 절차가 시작됩니다." />
        </View>
      )}

      <WizardFooter
        onPrev={goPrev}
        onNext={!isLast ? goNext : undefined}
        onSubmit={isLast ? submit : undefined}
        nextDisabled={!canNext}
        loading={loading}
      />
    </ScrollView>
  );
}

function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumK}>{k}</Text>
      <Text style={styles.sumV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  stepCap: { fontSize: FONT.h3, fontWeight: "700", color: PRIMARY[700], marginBottom: SPACING.md },
  helpText: { fontSize: 13, color: NEUTRAL.textMuted, marginBottom: SPACING.md },
  clientBanner: {
    fontSize: 15,
    fontWeight: "700",
    color: PRIMARY[700],
    backgroundColor: PRIMARY[50],
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    overflow: "hidden",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: NEUTRAL.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted },
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
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  goalCard: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },
  goalNum: { fontSize: 14, fontWeight: "800", color: PRIMARY[700] },
  summary: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: SPACING.md },
  sumK: { fontSize: 14, color: NEUTRAL.textMuted },
  sumV: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text, flex: 1, textAlign: "right" },
});
