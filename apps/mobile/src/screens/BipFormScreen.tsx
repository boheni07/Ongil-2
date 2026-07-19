import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bipSchema, type BehaviorFunction, type BipInput, type FbaBasis } from "@ongil/validation";
import { createBip, getBipClients, type BipClient } from "../lib/bip";
import { isSelfConfirmingStage } from "../lib/iep";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { Card } from "../components/Card";
import { DOMAIN_COLORS, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";

const EDU = DOMAIN_COLORS.EDU;
import type { TeacherStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TeacherStackParamList, "BipForm">;

const BEHAVIOR_FUNCTIONS: { value: BehaviorFunction; label: string; hint: string }[] = [
  { value: "attention", label: "관심획득", hint: "타인의 관심·반응을 얻기 위한 행동" },
  { value: "escape", label: "회피", hint: "과제·상황을 피하거나 벗어나기 위한 행동" },
  { value: "sensory", label: "감각추구", hint: "감각 자극 자체를 얻기 위한 행동" },
  { value: "other", label: "기타", hint: "위 분류에 속하지 않는 경우" },
];

const FBA_BASIS_OPTIONS: { value: FbaBasis; label: string }[] = [
  { value: "observation", label: "직접 관찰기록" },
  { value: "guardian_interview", label: "학부모 면담" },
  { value: "teacher_interview", label: "교사 면담" },
  { value: "checklist", label: "체크리스트" },
];

interface Draft {
  targetBehavior: string;
  behaviorFunction: BehaviorFunction;
  fbaBasis: FbaBasis[];
  antecedentStrategies: string;
  replacementBehavior: string;
  reinforcementPlan: string;
  crisisProcedure: string;
  reviewDate: string;
}

/**
 * T-17 행동중재계획(BIP, EDU-003) 작성 — 단일 폼(ObservationForm 스타일, 웹 BipForm.tsx 이식).
 * 학생 선택(파라미터 없을 때 칩 선택) → 중재 대상 행동·행동 기능 → 선행사건 전략·대체행동·강화 계획 →
 * 위기대응(선택)·재검토일. BIP는 공식 지원계획 문서라 requires_confirmation=true(§4-6①) —
 * 저장 시 서버 trg_assign_confirmer가 확인 주체(성년=본인, 미성년=주보호자)를 자동 지정한다.
 * BIP는 연령 가드가 없다(전 생애주기 작성 가능 — ITP·전환계획과 다름).
 */
export function BipFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params?.personId;

  const [students, setStudents] = useState<BipClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId ?? "");

  const [targetBehavior, setTargetBehavior] = useState("");
  const [behaviorFunction, setBehaviorFunction] = useState<BehaviorFunction>("attention");
  const [fbaBasis, setFbaBasis] = useState<FbaBasis[]>([]);
  const [antecedentStrategies, setAntecedentStrategies] = useState("");
  const [replacementBehavior, setReplacementBehavior] = useState("");
  const [reinforcementPlan, setReinforcementPlan] = useState("");
  const [crisisProcedure, setCrisisProcedure] = useState("");
  const [reviewDate, setReviewDate] = useState("");

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>(`bip:draft:${personId}`);

  const student = useMemo(
    () => students.find((s) => s.personId === personId) ?? null,
    [students, personId]
  );

  const snapshot = useCallback(
    (): Draft => ({
      targetBehavior,
      behaviorFunction,
      fbaBasis,
      antecedentStrategies,
      replacementBehavior,
      reinforcementPlan,
      crisisProcedure,
      reviewDate,
    }),
    [
      targetBehavior,
      behaviorFunction,
      fbaBasis,
      antecedentStrategies,
      replacementBehavior,
      reinforcementPlan,
      crisisProcedure,
      reviewDate,
    ]
  );

  const applyDraft = useCallback((d: Draft) => {
    setTargetBehavior(d.targetBehavior);
    setBehaviorFunction(d.behaviorFunction);
    setFbaBasis(Array.isArray(d.fbaBasis) ? d.fbaBasis : []);
    setAntecedentStrategies(d.antecedentStrategies);
    setReplacementBehavior(d.replacementBehavior);
    setReinforcementPlan(d.reinforcementPlan);
    setCrisisProcedure(d.crisisProcedure);
    setReviewDate(d.reviewDate);
  }, []);

  useEffect(() => {
    void (async () => {
      setStudents(await getBipClients());
    })();
  }, []);

  // 초기 진입 시 1회만 임시저장 복원 여부를 묻는다(학생 전환 시 재프롬프트 방지).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void checkRestore(applyDraft);
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [saveDraft, snapshot]);

  const toggleFba = (v: FbaBasis) =>
    setFbaBasis((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const buildInput = (): BipInput => ({
    target_behavior: targetBehavior.trim(),
    behavior_function: behaviorFunction,
    ...(fbaBasis.length > 0 ? { fba_basis: fbaBasis } : {}),
    antecedent_strategies: antecedentStrategies.trim(),
    replacement_behavior: replacementBehavior.trim(),
    reinforcement_plan: reinforcementPlan.trim(),
    ...(crisisProcedure.trim() ? { crisis_procedure: crisisProcedure.trim() } : {}),
    review_date: reviewDate.trim(),
  });

  const submit = () =>
    run(async () => {
      if (!personId) return "학생을 선택해주세요.";
      const input = buildInput();
      const parsed = bipSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createBip(personId, input);
      if (res.error) return res.error;
      clearDraft();
      navigation.goBack();
    });

  if (!paramPersonId && students.length === 0) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <Text style={styles.title}>행동중재계획(BIP) 작성</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>담당 학생이 없습니다.</Text>
          <Text style={styles.emptyHint}>
            보호자가 교육(EDU) 도메인 작성 권한을 부여하면 해당 학생의 BIP를 작성할 수 있습니다.
          </Text>
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
      <Text style={styles.title}>
        행동중재계획(BIP) 작성 <Text style={styles.code}>EDU-003</Text>
      </Text>
      <Text style={styles.sub}>
        기능평가(FBA)에 기반해 대상 행동·대체행동·강화 계획을 기록하는 공식 지원계획 문서입니다.
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        {!paramPersonId ? (
          <>
            <Text style={styles.label}>대상 학생</Text>
            <View style={styles.pickWrap}>
              {students.map((s) => (
                <CategoryChip
                  key={s.personId}
                  emoji="🧑‍🎓"
                  label={s.fullName}
                  selected={personId === s.personId}
                  onPress={() => setPersonId(s.personId)}
                />
              ))}
            </View>
          </>
        ) : (
          <Text style={[styles.studentBanner, { color: EDU.text, backgroundColor: EDU.bg }]}>
            학생: {route.params?.personName}
          </Text>
        )}

        {student ? (
          <View style={styles.stageRow}>
            <StageBadge lifeStage={student.lifeStage} />
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.label}>행동 기능 (FBA)</Text>
        <View style={styles.pickWrap}>
          {BEHAVIOR_FUNCTIONS.map((f) => (
            <CategoryChip
              key={f.value}
              emoji="🎯"
              label={f.label}
              selected={behaviorFunction === f.value}
              onPress={() => setBehaviorFunction(f.value)}
            />
          ))}
        </View>
        <Text style={styles.hintText}>
          {BEHAVIOR_FUNCTIONS.find((f) => f.value === behaviorFunction)?.hint}
        </Text>

        <Text style={styles.label}>기능평가 근거 (선택, 복수선택 가능)</Text>
        <View style={styles.pickWrap}>
          {FBA_BASIS_OPTIONS.map((opt) => (
            <CategoryChip
              key={opt.value}
              emoji="🔎"
              label={opt.label}
              selected={fbaBasis.includes(opt.value)}
              onPress={() => toggleFba(opt.value)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.label}>중재 대상 행동</Text>
        <TextInput
          accessibilityLabel="중재 대상 행동"
          value={targetBehavior}
          onChangeText={setTargetBehavior}
          placeholder="중재가 필요한 문제 행동을 관찰 가능한 용어로 구체적으로 기술하세요."
          placeholderTextColor={NEUTRAL.textMuted}
          maxLength={2000}
          multiline
          style={styles.textarea}
        />

        <Text style={styles.label}>선행사건 중재 전략</Text>
        <TextInput
          accessibilityLabel="선행사건 중재 전략"
          value={antecedentStrategies}
          onChangeText={setAntecedentStrategies}
          placeholder="문제 행동을 유발하는 선행사건을 조정·예방하기 위한 전략을 기록하세요."
          placeholderTextColor={NEUTRAL.textMuted}
          maxLength={3000}
          multiline
          style={styles.textarea}
        />

        <Text style={styles.label}>대체행동</Text>
        <TextInput
          accessibilityLabel="대체행동"
          value={replacementBehavior}
          onChangeText={setReplacementBehavior}
          placeholder="같은 기능을 수행하되 사회적으로 수용 가능한 대체행동을 기록하세요."
          placeholderTextColor={NEUTRAL.textMuted}
          maxLength={2000}
          multiline
          style={styles.textarea}
        />

        <Text style={styles.label}>강화 계획</Text>
        <TextInput
          accessibilityLabel="강화 계획"
          value={reinforcementPlan}
          onChangeText={setReinforcementPlan}
          placeholder="대체행동을 촉진할 강화물·강화 일정·소거 절차 등을 기록하세요."
          placeholderTextColor={NEUTRAL.textMuted}
          maxLength={3000}
          multiline
          style={styles.textarea}
        />

        <Text style={styles.label}>위기대응 절차 (선택)</Text>
        <TextInput
          accessibilityLabel="위기대응 절차"
          value={crisisProcedure}
          onChangeText={setCrisisProcedure}
          placeholder="심각한 위기 행동 발생 시 안전 확보 절차를 기록하세요. (경도 사례는 비워둘 수 있습니다)"
          placeholderTextColor={NEUTRAL.textMuted}
          maxLength={3000}
          multiline
          style={styles.textarea}
        />

        <Text style={styles.label}>재검토 예정일</Text>
        <DateField
          accessibilityLabel="재검토 예정일. 예시 2026-12-01"
          value={reviewDate}
          onChange={setReviewDate}
          style={styles.input}
        />
      </Card>

      <InfoBanner
        message={`행동중재계획은 공식 지원계획 문서로 저장 시 확인 절차가 시작됩니다. 확인 요청 대상: ${
          student && isSelfConfirmingStage(student.lifeStage) ? "본인" : "보호자"
        }`}
      />

      <WizardFooter onPrev={() => navigation.goBack()} onSubmit={submit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  code: { fontSize: FONT.body, fontWeight: "600", color: NEUTRAL.textMuted },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2, marginBottom: SPACING.md },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: NEUTRAL.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  hintText: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: SPACING.xs },
  studentBanner: {
    fontSize: 15,
    fontWeight: "700",
    color: PRIMARY[700],
    backgroundColor: PRIMARY[50],
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    overflow: "hidden",
  },
  stageRow: { marginTop: SPACING.sm },
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
    minHeight: 84,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: NEUTRAL.text,
    textAlignVertical: "top",
  },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  emptyBox: {
    marginTop: SPACING.lg,
    padding: SPACING.xl,
    alignItems: "center",
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.md,
  },
  emptyText: { fontSize: FONT.body, fontWeight: "700", color: NEUTRAL.text },
  emptyHint: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 6, textAlign: "center" },
});
