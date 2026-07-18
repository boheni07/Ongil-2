import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { transitionPlanSchema, type RoadmapStage, type TransitionPlanInput } from "@ongil/validation";
import {
  createTransitionPlan,
  getTransitionPlanClients,
  type TransitionClient,
} from "../lib/transition";
import { isPreTransitionStage, isSelfConfirmingStage } from "../lib/iep";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { RoadmapProgress } from "../components/RoadmapProgress";
import { StepBar } from "../components/StepBar";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "TransitionPlanWizard">;

type TrainingStatus = "planned" | "ongoing" | "completed";

interface Training {
  program: string;
  provider: string;
  start: string;
  end: string;
  status: TrainingStatus;
}

interface Draft {
  personId: string;
  careerGoal: string;
  roadmapStage: RoadmapStage;
  independentLivingPlan: string;
  trainings: Training[];
  linkedAgencies: string[];
  caseManager: string;
  nextReviewDate: string;
}

const STEP_CAPS: Record<number, string> = {
  1: "기본 정보",
  2: "전환 로드맵",
  3: "훈련 이력",
  4: "연계 기관",
  5: "확인 · 제출",
};

const TOTAL_STEPS = 5;

const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  planned: "예정",
  ongoing: "진행 중",
  completed: "완료",
};

function emptyTraining(): Training {
  return { program: "", provider: "", start: "", end: "", status: "planned" };
}
function isoPlusMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * W-16 전환계획(TRA-001) 작성 5단계 위저드(사회복지사).
 * 만 13세 미만(영유아기·아동기) 당사자를 선택하면 폼 대신 진입 가드 안내로 대체한다
 * (docs/02-ia.md §3-9). 제출 전 마지막 단계에서 확인 요청 대상(성년=본인/미성년=보호자)을 안내한다.
 */
export function TransitionPlanWizardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params.personId;

  const [clients, setClients] = useState<TransitionClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId);
  const [careerGoal, setCareerGoal] = useState("");
  const [roadmapStage, setRoadmapStage] = useState<RoadmapStage>("exploration");
  const [independentLivingPlan, setIndependentLivingPlan] = useState("");
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [linkedAgencies, setLinkedAgencies] = useState<string[]>([]);
  const [caseManager, setCaseManager] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState(isoPlusMonths(6));

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>("transition:draft");

  const selectedClient = clients.find((c) => c.personId === personId) ?? null;
  const isChild = !!selectedClient && isPreTransitionStage(selectedClient.lifeStage);
  const isAdult = !!selectedClient && isSelfConfirmingStage(selectedClient.lifeStage);

  const [step, setStep] = useState(1);

  const snapshot = useCallback(
    (): Draft => ({
      personId,
      careerGoal,
      roadmapStage,
      independentLivingPlan,
      trainings,
      linkedAgencies,
      caseManager,
      nextReviewDate,
    }),
    [personId, careerGoal, roadmapStage, independentLivingPlan, trainings, linkedAgencies, caseManager, nextReviewDate]
  );

  const applyDraft = useCallback((d: Draft) => {
    setPersonId(d.personId);
    setCareerGoal(d.careerGoal);
    setRoadmapStage(d.roadmapStage);
    setIndependentLivingPlan(d.independentLivingPlan);
    setTrainings(Array.isArray(d.trainings) ? d.trainings : []);
    setLinkedAgencies(Array.isArray(d.linkedAgencies) ? d.linkedAgencies : []);
    setCaseManager(d.caseManager);
    setNextReviewDate(d.nextReviewDate);
  }, []);

  useEffect(() => {
    void (async () => {
      setClients(await getTransitionPlanClients());
      await checkRestore(applyDraft);
    })();
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [step, saveDraft, snapshot]);

  const updateTraining = (i: number, patch: Partial<Training>) =>
    setTrainings((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTraining = () => setTrainings((prev) => [...prev, emptyTraining()]);
  const removeTraining = (i: number) => setTrainings((prev) => prev.filter((_, idx) => idx !== i));

  const updateAgency = (i: number, value: string) =>
    setLinkedAgencies((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  const addAgency = () => setLinkedAgencies((prev) => [...prev, ""]);
  const removeAgency = (i: number) => setLinkedAgencies((prev) => prev.filter((_, idx) => idx !== i));

  const buildInput = (): TransitionPlanInput => ({
    roadmap_stage: roadmapStage,
    career_goal: careerGoal.trim(),
    independent_living_plan: independentLivingPlan.trim() || undefined,
    training_records: trainings
      .filter((t) => t.program.trim() || t.provider.trim())
      .map((t) => ({
        program: t.program.trim(),
        provider: t.provider.trim(),
        period: { start: t.start.trim(), end: t.end.trim() },
        status: t.status,
      })),
    linked_agencies: linkedAgencies.map((a) => a.trim()).filter(Boolean),
    case_manager: caseManager.trim(),
    next_review_date: nextReviewDate.trim(),
  });

  const dateOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const canNext =
    (step === 1 &&
      Boolean(personId) &&
      !isChild &&
      careerGoal.trim().length > 0 &&
      caseManager.trim().length > 0 &&
      dateOk(nextReviewDate)) ||
    step === 2 ||
    step === 3 ||
    step === 4 ||
    step === 5;

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => {
    if (step === 1) navigation.goBack();
    else setStep((s) => s - 1);
  };

  const submit = () =>
    run(async () => {
      const input = buildInput();
      const parsed = transitionPlanSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createTransitionPlan(personId, parsed.data);
      if (res.error) return res.error;
      clearDraft();
      navigation.goBack();
    });

  const isLast = step === TOTAL_STEPS;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepBar current={step} total={TOTAL_STEPS} label="전환계획 작성" />
      <Text style={styles.stepCap}>
        {step}/{TOTAL_STEPS} · {STEP_CAPS[step]}
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      {selectedClient?.latestPlan ? (
        <View style={styles.latestCard}>
          <Text style={styles.latestTitle}>최근 전환계획</Text>
          {selectedClient.latestPlan.roadmapStage ? (
            <RoadmapProgress stage={selectedClient.latestPlan.roadmapStage} />
          ) : null}
          <Text style={styles.latestMeta}>
            {selectedClient.latestPlan.confirmedAt
              ? "확인 완료됨"
              : selectedClient.latestPlan.requiresConfirmation
                ? "확인 대기 중"
                : "확인 불필요"}
            {" · 아래에서 새 전환계획을 작성합니다."}
          </Text>
        </View>
      ) : null}

      {step === 1 && (
        <View>
          {!paramPersonId ? (
            <>
              <Text style={styles.label}>대상 당사자</Text>
              {clients.length === 0 ? (
                <Text style={styles.muted}>전환계획 권한(TRA)이 있는 담당 당사자가 없습니다.</Text>
              ) : (
                <View style={styles.pickWrap}>
                  {clients.map((c) => (
                    <CategoryChip
                      key={c.personId}
                      emoji="🧑"
                      label={c.fullName}
                      selected={personId === c.personId}
                      onPress={() => setPersonId(c.personId)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.clientBanner}>당사자: {route.params.personName}</Text>
          )}

          {selectedClient ? (
            <View style={styles.stageRow}>
              <StageBadge lifeStage={selectedClient.lifeStage} />
            </View>
          ) : null}

          {isChild ? (
            <View style={styles.guard}>
              <Text style={styles.guardIcon}>🌱</Text>
              <Text style={styles.guardTitle}>만 13세 이상부터 전환계획을 작성할 수 있습니다</Text>
              <Text style={styles.guardText}>
                전환계획(TRA-001)은 청소년 전환기(만 13세) 이후 당사자를 대상으로 합니다. 다른 당사자를
                선택하거나, 아동기 당사자는 교육·활동 기록으로 준비를 시작하세요.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>희망 진로</Text>
              <TextInput
                accessibilityLabel="희망 진로"
                value={careerGoal}
                onChangeText={setCareerGoal}
                placeholder="예: 바리스타로 카페 취업"
                placeholderTextColor={NEUTRAL.textMuted}
                multiline
                style={styles.textarea}
              />
              <Text style={styles.label}>담당자 (사례관리자)</Text>
              <TextInput
                accessibilityLabel="담당자 사례관리자"
                value={caseManager}
                onChangeText={setCaseManager}
                placeholder="예: 최복지"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>다음 검토 예정일</Text>
              <TextInput
                accessibilityLabel="다음 검토 예정일. 예시 2027-01-14"
                value={nextReviewDate}
                onChangeText={setNextReviewDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
            </>
          )}
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.label}>현재 전환 로드맵 단계</Text>
          <Text style={styles.helpText}>당사자의 현재 위치를 선택하세요. 이후 진행에 따라 갱신합니다.</Text>
          <RoadmapProgress stage={roadmapStage} onChange={setRoadmapStage} />
          <Text style={styles.label}>자립생활 계획 (선택)</Text>
          <TextInput
            accessibilityLabel="자립생활 계획"
            value={independentLivingPlan}
            onChangeText={setIndependentLivingPlan}
            placeholder="주거·이동·금전관리 등 자립생활 목표와 지원 계획"
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />
        </View>
      )}

      {step === 3 && (
        <View>
          <InfoBanner message="훈련 이력은 선택입니다. 없으면 비워두고 넘어가세요." />
          {trainings.map((t, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardNum}>훈련 {i + 1}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`훈련 ${i + 1} 삭제`}
                  onPress={() => removeTraining(i)}
                  style={styles.agencyRemove}
                  hitSlop={8}
                >
                  <Text style={styles.removeText}>삭제</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>프로그램</Text>
              <TextInput
                accessibilityLabel={`훈련 ${i + 1} 프로그램`}
                value={t.program}
                onChangeText={(v) => updateTraining(i, { program: v })}
                placeholder="예: 바리스타 직업훈련"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>제공기관</Text>
              <TextInput
                accessibilityLabel={`훈련 ${i + 1} 제공기관`}
                value={t.provider}
                onChangeText={(v) => updateTraining(i, { provider: v })}
                placeholder="예: 한국장애인고용공단"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
              <View style={styles.stRow}>
                <View style={styles.stHalf}>
                  <Text style={styles.label}>시작</Text>
                  <TextInput
                    accessibilityLabel={`훈련 ${i + 1} 시작`}
                    value={t.start}
                    onChangeText={(v) => updateTraining(i, { start: v })}
                    placeholder="예: 2026-03"
                    placeholderTextColor={NEUTRAL.textMuted}
                    style={styles.input}
                  />
                </View>
                <View style={styles.stHalf}>
                  <Text style={styles.label}>종료</Text>
                  <TextInput
                    accessibilityLabel={`훈련 ${i + 1} 종료`}
                    value={t.end}
                    onChangeText={(v) => updateTraining(i, { end: v })}
                    placeholder="예: 2026-08 (미정 가능)"
                    placeholderTextColor={NEUTRAL.textMuted}
                    style={styles.input}
                  />
                </View>
              </View>
              <Text style={styles.label}>진행 상태</Text>
              <View style={styles.pickWrap}>
                {(Object.keys(TRAINING_STATUS_LABEL) as TrainingStatus[]).map((s) => (
                  <CategoryChip
                    key={s}
                    emoji="📌"
                    label={TRAINING_STATUS_LABEL[s]}
                    selected={t.status === s}
                    onPress={() => updateTraining(i, { status: s })}
                  />
                ))}
              </View>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="훈련 이력 추가"
            onPress={addTraining}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>＋ 훈련 이력 추가</Text>
          </Pressable>
        </View>
      )}

      {step === 4 && (
        <View>
          <InfoBanner message="연계 기관은 선택입니다. 협력·의뢰 기관을 등록하세요." />
          {linkedAgencies.map((a, i) => (
            <View key={i} style={styles.agencyRow}>
              <TextInput
                accessibilityLabel={`연계 기관 ${i + 1}`}
                value={a}
                onChangeText={(v) => updateAgency(i, v)}
                placeholder="예: 발달장애인지원센터"
                placeholderTextColor={NEUTRAL.textMuted}
                style={[styles.input, styles.agencyInput]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`연계 기관 ${i + 1} 삭제`}
                onPress={() => removeAgency(i)}
                hitSlop={8}
                style={styles.agencyRemove}
              >
                <Text style={styles.removeText}>삭제</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="연계 기관 추가"
            onPress={addAgency}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>＋ 연계 기관 추가</Text>
          </Pressable>
        </View>
      )}

      {step === 5 && (
        <View>
          <Text style={styles.helpText}>입력 내용을 확인하고 제출하세요.</Text>
          <RoadmapProgress stage={roadmapStage} />
          <View style={styles.summary}>
            <SumRow k="당사자" v={selectedClient?.fullName || route.params.personName || "-"} />
            <SumRow k="희망 진로" v={careerGoal.trim() || "-"} />
            <SumRow k="담당자" v={caseManager.trim() || "-"} />
            <SumRow k="다음 검토" v={nextReviewDate} />
            <SumRow
              k="훈련 이력"
              v={`${trainings.filter((t) => t.program.trim() || t.provider.trim()).length}건`}
            />
            <SumRow
              k="연계 기관"
              v={`${linkedAgencies.filter((a) => a.trim()).length}곳`}
            />
            <SumRow k="확인 요청 대상" v={isAdult ? "본인" : "보호자"} />
          </View>
          <InfoBanner message="전환계획은 공식 문서입니다. 제출 시 당사자·보호자 확인 절차가 시작됩니다." />
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
  stageRow: { marginTop: SPACING.sm, marginBottom: SPACING.sm },
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
  card: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardNum: { fontSize: 14, fontWeight: "800", color: PRIMARY[700] },
  removeText: { fontSize: 13, fontWeight: "700", color: NEUTRAL.danger },
  stRow: { flexDirection: "row", gap: SPACING.sm },
  stHalf: { flex: 1 },
  agencyRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  agencyInput: { flex: 1 },
  agencyRemove: { minHeight: 44, justifyContent: "center", paddingHorizontal: SPACING.sm },
  addBtn: {
    marginTop: SPACING.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    borderStyle: "dashed",
    backgroundColor: PRIMARY[50],
  },
  addBtnText: { fontSize: 15, fontWeight: "700", color: PRIMARY[700] },
  pressed: { opacity: 0.85 },
  guard: {
    marginTop: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
    alignItems: "center",
    gap: SPACING.sm,
  },
  guardIcon: { fontSize: 40 },
  guardTitle: { fontSize: 17, fontWeight: "800", color: NEUTRAL.text, textAlign: "center" },
  guardText: { fontSize: 14, color: NEUTRAL.textMuted, textAlign: "center", lineHeight: 20 },
  latestCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: PRIMARY[400],
    backgroundColor: PRIMARY[50],
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  latestTitle: { fontSize: 13, fontWeight: "800", color: PRIMARY[700] },
  latestMeta: { fontSize: 12, color: PRIMARY[700] },
  summary: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    padding: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: SPACING.md },
  sumK: { fontSize: 14, color: NEUTRAL.textMuted },
  sumV: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text, flex: 1, textAlign: "right" },
});
