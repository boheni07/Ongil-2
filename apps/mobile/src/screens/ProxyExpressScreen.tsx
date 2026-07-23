import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { selfExpressionSchema, type SelfExpressionInput } from "@ongil/validation";
import { createSelfExpressionForPerson } from "../lib/guardian";
import {
  ACTIVITY_CHOICES,
  HEALTH_CHOICES,
  MEAL_CHOICES,
  MOOD_CHOICES,
} from "../lib/content";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { PersonIconGrid } from "../components/IconSelector";
import { PersonQuestion, WizardFooter } from "../components/WizardStep";
import { StepBar } from "../components/StepBar";
import { ErrorBanner } from "../components/ui";
import { NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "ProxyExpress">;

type Mood = SelfExpressionInput["mood"];
type Meal = SelfExpressionInput["meal"];
type Health = SelfExpressionInput["health"];
type Activity = NonNullable<SelfExpressionInput["activities"]>[number];

/**
 * G-22 보호자 대리 자기표현 4단계 위저드 — 기분→식사→활동→건강.
 * 당사자 본인용 P-02(SelfExpressionScreen)의 UI를 그대로 재사용하되, 제출 핸들러만
 * createSelfExpressionForPerson(personId, …)로 바꾼 보호자용 변형이다. 저장 시 author_id=보호자,
 * person_id=당사자로 기록돼 감사에서 대리 작성임이 구분된다(웹 ProxyExpressWizard와 동형).
 */
export function ProxyExpressScreen({ navigation, route }: Props) {
  const { personId, personName } = route.params;
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState<Mood | null>(null);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memo, setMemo] = useState("");
  const [saved, setSaved] = useState(false);
  const { loading, error, run } = useAsyncAction();

  const canNext =
    (step === 1 && mood) ||
    (step === 2 && meal) ||
    step === 3 ||
    (step === 4 && health);

  const toggleActivity = (v: Activity) =>
    setActivities((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const submit = () =>
    run(async () => {
      const parsed = selfExpressionSchema.safeParse({
        mood,
        meal,
        activities,
        health,
        memo: memo.trim() ? memo.trim() : undefined,
      });
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createSelfExpressionForPerson(personId, parsed.data);
      if (res.error) return res.error;
      setSaved(true);
      setTimeout(() => navigation.goBack(), 1800);
    });

  if (saved) {
    return (
      <View style={styles.overlay} accessibilityLiveRegion="assertive">
        <Text style={styles.confetti}>🎉 ⭐ 💚 ✨</Text>
        <Text style={styles.savedMsg}>저장했어요!</Text>
        <Text style={styles.savedSub}>{personName} 님의 오늘을 기록했습니다 💚</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>대신 자기표현 남기기</Text>
      <Text style={styles.sub}>
        {personName} 님을 대신해 오늘의 기분·활동을 기록합니다. 대리 작성 사실이 함께 기록됩니다.
      </Text>
      <StepBar current={step} total={4} label="오늘 이야기" />
      {error ? <ErrorBanner message={error} /> : null}

      {step === 1 && (
        <>
          <PersonQuestion question="지금 기분이 어때요?" />
          <PersonIconGrid choices={MOOD_CHOICES} selected={mood} onSelect={setMood} />
        </>
      )}

      {step === 2 && (
        <>
          <PersonQuestion question="밥 먹었어요?" />
          <PersonIconGrid choices={MEAL_CHOICES} selected={meal} onSelect={setMeal} />
        </>
      )}

      {step === 3 && (
        <>
          <PersonQuestion question="오늘 뭘 했어요?" hint="여러 개 골라도 돼요" />
          <PersonIconGrid choices={ACTIVITY_CHOICES} selected={activities} onSelect={toggleActivity} multi />
        </>
      )}

      {step === 4 && (
        <>
          <PersonQuestion question="몸은 어때요?" />
          <PersonIconGrid choices={HEALTH_CHOICES} selected={health} onSelect={setHealth} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="메모 남기기"
            onPress={() => setMemoOpen((v) => !v)}
            style={styles.extraBtn}
          >
            <Text style={styles.extraText}>📝 하고 싶은 말 남기기</Text>
          </Pressable>
          {memoOpen ? (
            <TextInput
              accessibilityLabel="메모"
              value={memo}
              onChangeText={setMemo}
              placeholder="당사자를 대신해 남길 내용을 자유롭게 적어요"
              placeholderTextColor={NEUTRAL.textMuted}
              multiline
              maxLength={1000}
              style={styles.memo}
            />
          ) : null}
        </>
      )}

      <WizardFooter
        onPrev={step > 1 ? () => setStep((s) => s - 1) : () => navigation.goBack()}
        onNext={step < 4 ? () => setStep((s) => s + 1) : undefined}
        onSubmit={step === 4 ? submit : undefined}
        nextDisabled={!canNext}
        loading={loading}
        large
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  heading: { fontSize: 22, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: 14, color: NEUTRAL.textMuted, marginTop: 4, marginBottom: SPACING.md },
  extraBtn: {
    marginTop: SPACING.lg,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    borderStyle: "dashed",
  },
  extraText: { fontSize: 18, fontWeight: "600", color: NEUTRAL.textMuted },
  memo: {
    marginTop: SPACING.sm,
    minHeight: 88,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 18,
    color: NEUTRAL.text,
    textAlignVertical: "top",
  },
  overlay: {
    flex: 1,
    backgroundColor: PRIMARY[900],
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  confetti: { fontSize: 48, letterSpacing: 8 },
  savedMsg: { fontSize: 30, fontWeight: "800", color: "#fff" },
  savedSub: { fontSize: 18, color: "#D9F2E7", textAlign: "center" },
});
