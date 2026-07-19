import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { iepSchema } from "@ongil/validation";
import { createIep, getTeacherStudents, isPreTransitionStage, isSelfConfirmingStage, type LifeStage, type TeacherStudent } from "../lib/iep";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StepBar } from "../components/StepBar";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TeacherStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TeacherStackParamList, "IepWizard">;

interface ShortTerm {
  goal: string;
  period: string;
  evaluation: string;
}
interface AnnualGoal {
  area: string;
  goal: string;
  shortTerms: ShortTerm[];
}
interface SupportService {
  service: string;
  provider: string;
  frequency: string;
}

interface Draft {
  personId: string;
  school: string;
  academicYear: string;
  meetingDate: string;
  participants: string;
  levels: {
    korean: string;
    math: string;
    social: string;
    communication: string;
    self_care: string;
  };
  annualGoals: AnnualGoal[];
  supportServices: SupportService[];
  transitionGoalArea: "" | "career" | "independent_living" | "community" | "further_education";
  transitionGoal: string;
  transitionSteps: string;
  transitionAgencies: string;
}

const TRANSITION_GOAL_AREAS: { value: "career" | "independent_living" | "community" | "further_education"; label: string }[] = [
  { value: "career", label: "진로·직업" },
  { value: "independent_living", label: "자립생활" },
  { value: "community", label: "지역사회 참여" },
  { value: "further_education", label: "계속교육" },
];

const LEVEL_FIELDS: { key: keyof Draft["levels"]; label: string }[] = [
  { key: "korean", label: "국어" },
  { key: "math", label: "수학" },
  { key: "social", label: "사회성" },
  { key: "communication", label: "의사소통" },
  { key: "self_care", label: "자조기술" },
];

const STEP_CAPS: Record<number, string> = {
  1: "기본 정보",
  2: "현재 학습 수준",
  3: "연간 목표 · 단기 목표",
  4: "지원 서비스",
  5: "전환 계획",
  6: "확인 · 저장",
};

function emptyGoal(): AnnualGoal {
  return { area: "", goal: "", shortTerms: [{ goal: "", period: "", evaluation: "" }] };
}

function currentAcademicYear(): string {
  return String(new Date().getFullYear());
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** T-13 IEP 작성 6단계 위저드. 5단계(전환계획)는 학생이 만 13세+(영유아기·아동기가 아닐 때)만 노출. */
export function IepWizardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params.personId;

  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [personId, setPersonId] = useState(paramPersonId);
  const [school, setSchool] = useState("");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [meetingDate, setMeetingDate] = useState(todayISO());
  const [participants, setParticipants] = useState("특수교사, 학부모");
  const [levels, setLevels] = useState<Draft["levels"]>({
    korean: "",
    math: "",
    social: "",
    communication: "",
    self_care: "",
  });
  const [annualGoals, setAnnualGoals] = useState<AnnualGoal[]>([emptyGoal()]);
  const [supportServices, setSupportServices] = useState<SupportService[]>([
    { service: "", provider: "", frequency: "" },
  ]);
  const [transitionGoalArea, setTransitionGoalArea] = useState<Draft["transitionGoalArea"]>("");
  const [transitionGoal, setTransitionGoal] = useState("");
  const [transitionSteps, setTransitionSteps] = useState("");
  const [transitionAgencies, setTransitionAgencies] = useState("");

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>("iep:draft");

  const selectedStudent = students.find((s) => s.personId === personId) ?? null;
  const lifeStage: LifeStage = selectedStudent?.lifeStage ?? "child";
  const showTransition = !isPreTransitionStage(lifeStage);

  // 노출되는 단계 순서(전환계획은 만 13세+에서만).
  const visibleSteps = useMemo(
    () => (showTransition ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 6]),
    [showTransition]
  );
  const [stepIdx, setStepIdx] = useState(0);
  const step = visibleSteps[Math.min(stepIdx, visibleSteps.length - 1)];

  const snapshot = useCallback(
    (): Draft => ({
      personId,
      school,
      academicYear,
      meetingDate,
      participants,
      levels,
      annualGoals,
      supportServices,
      transitionGoalArea,
      transitionGoal,
      transitionSteps,
      transitionAgencies,
    }),
    [
      personId,
      school,
      academicYear,
      meetingDate,
      participants,
      levels,
      annualGoals,
      supportServices,
      transitionGoalArea,
      transitionGoal,
      transitionSteps,
      transitionAgencies,
    ]
  );

  const applyDraft = useCallback((d: Draft) => {
    setPersonId(d.personId);
    setSchool(d.school);
    setAcademicYear(d.academicYear);
    setMeetingDate(d.meetingDate);
    setParticipants(d.participants);
    setLevels(d.levels);
    setAnnualGoals(d.annualGoals.length ? d.annualGoals : [emptyGoal()]);
    setSupportServices(
      d.supportServices.length ? d.supportServices : [{ service: "", provider: "", frequency: "" }]
    );
    setTransitionGoalArea(d.transitionGoalArea);
    setTransitionGoal(d.transitionGoal);
    setTransitionSteps(d.transitionSteps);
    setTransitionAgencies(d.transitionAgencies);
  }, []);

  useEffect(() => {
    void (async () => {
      setStudents(await getTeacherStudents());
      await checkRestore(applyDraft);
    })();
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [stepIdx, saveDraft, snapshot]);

  const setLevel = (key: keyof Draft["levels"], v: string) =>
    setLevels((prev) => ({ ...prev, [key]: v }));

  const updateGoal = (i: number, patch: Partial<AnnualGoal>) =>
    setAnnualGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const updateShortTerm = (gi: number, si: number, patch: Partial<ShortTerm>) =>
    setAnnualGoals((prev) =>
      prev.map((g, idx) =>
        idx === gi
          ? { ...g, shortTerms: g.shortTerms.map((st, j) => (j === si ? { ...st, ...patch } : st)) }
          : g
      )
    );
  const addGoal = () => setAnnualGoals((prev) => [...prev, emptyGoal()]);
  const addShortTerm = (gi: number) =>
    setAnnualGoals((prev) =>
      prev.map((g, idx) =>
        idx === gi ? { ...g, shortTerms: [...g.shortTerms, { goal: "", period: "", evaluation: "" }] } : g
      )
    );
  const updateService = (i: number, patch: Partial<SupportService>) =>
    setSupportServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addService = () =>
    setSupportServices((prev) => [...prev, { service: "", provider: "", frequency: "" }]);

  const buildInput = () => ({
    personId,
    school: school.trim(),
    academic_year: academicYear.trim(),
    meeting_date: meetingDate.trim(),
    participants: participants
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    current_levels: {
      korean: levels.korean.trim(),
      math: levels.math.trim(),
      social: levels.social.trim(),
      communication: levels.communication.trim(),
      self_care: levels.self_care.trim(),
    },
    annual_goals: annualGoals
      .filter((g) => g.area.trim() || g.goal.trim())
      .map((g) => ({
        area: g.area.trim(),
        goal: g.goal.trim(),
        short_term_goals: g.shortTerms
          .filter((st) => st.goal.trim() || st.period.trim() || st.evaluation.trim())
          .map((st) => ({
            goal: st.goal.trim(),
            period: st.period.trim(),
            evaluation: st.evaluation.trim(),
          })),
      })),
    support_services: supportServices
      .filter((s) => s.service.trim() || s.provider.trim() || s.frequency.trim())
      .map((s) => ({
        service: s.service.trim(),
        provider: s.provider.trim(),
        frequency: s.frequency.trim(),
      })),
    transition_plan:
      showTransition && transitionGoal.trim()
        ? {
            ...(transitionGoalArea ? { goal_area: transitionGoalArea } : {}),
            goal: transitionGoal.trim(),
            steps: transitionSteps
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            ...(transitionAgencies.trim() ? { linked_agencies: transitionAgencies.trim() } : {}),
          }
        : undefined,
  });

  const canNext =
    (step === 1 &&
      personId &&
      school.trim() &&
      academicYear.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) ||
    step === 2 ||
    (step === 3 && annualGoals.some((g) => g.area.trim() && g.goal.trim())) ||
    step === 4 ||
    step === 5 ||
    step === 6;

  const goNext = () => setStepIdx((i) => Math.min(i + 1, visibleSteps.length - 1));
  const goPrev = () => {
    if (stepIdx === 0) navigation.goBack();
    else setStepIdx((i) => i - 1);
  };

  const submit = () =>
    run(async () => {
      const input = buildInput();
      const parsed = iepSchema.safeParse((({ personId: _pid, ...rest }) => rest)(input));
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createIep(input);
      if (res.error) return res.error;
      clearDraft();
      if (res.recordId) navigation.replace("IepReview", { recordId: res.recordId });
      else navigation.goBack();
    });

  const isLast = step === 6;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepBar current={stepIdx + 1} total={visibleSteps.length} label="IEP 작성" />
      <Text style={styles.stepCap}>
        {stepIdx + 1}/{visibleSteps.length} · {STEP_CAPS[step]}
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      {step === 1 && (
        <View>
          {!paramPersonId ? (
            <>
              <Text style={styles.label}>대상 학생</Text>
              {students.length === 0 ? (
                <Text style={styles.muted}>담당 학생이 없습니다.</Text>
              ) : (
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
              )}
            </>
          ) : (
            <Text style={styles.studentBanner}>학생: {route.params.personName}</Text>
          )}
          <Text style={styles.label}>학교명</Text>
          <TextInput
            accessibilityLabel="학교명"
            value={school}
            onChangeText={setSchool}
            placeholder="예: 온길특수학교"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>학년도</Text>
          <TextInput
            accessibilityLabel="학년도"
            value={academicYear}
            onChangeText={setAcademicYear}
            placeholder="예: 2026"
            placeholderTextColor={NEUTRAL.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={styles.label}>IEP 회의 날짜</Text>
          <DateField
            accessibilityLabel="IEP 회의 날짜. 예시 2026-03-05"
            value={meetingDate}
            onChange={setMeetingDate}
            style={styles.input}
          />
          <Text style={styles.label}>참석자 (쉼표로 구분)</Text>
          <TextInput
            accessibilityLabel="참석자. 쉼표로 구분"
            value={participants}
            onChangeText={setParticipants}
            placeholder="특수교사, 학부모, 통합학급 담임"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.helpText}>5개 영역의 현재 수행 수준을 기술하세요.</Text>
          {LEVEL_FIELDS.map((f) => (
            <View key={f.key}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                accessibilityLabel={`${f.label} 현재 수준`}
                value={levels[f.key]}
                onChangeText={(v) => setLevel(f.key, v)}
                placeholder="현재 수행 수준을 구체적으로 기술하세요"
                placeholderTextColor={NEUTRAL.textMuted}
                multiline
                style={styles.textarea}
              />
            </View>
          ))}
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.helpText}>연간 목표별로 단기 목표와 평가 방법을 설정하세요.</Text>
          {annualGoals.map((g, gi) => (
            <View key={gi} style={styles.goalCard}>
              <Text style={styles.goalNum}>연간 목표 {gi + 1}</Text>
              <Text style={styles.label}>영역</Text>
              <TextInput
                accessibilityLabel={`연간 목표 ${gi + 1} 영역`}
                value={g.area}
                onChangeText={(v) => updateGoal(gi, { area: v })}
                placeholder="예: 국어"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>연간 목표</Text>
              <TextInput
                accessibilityLabel={`연간 목표 ${gi + 1} 내용`}
                value={g.goal}
                onChangeText={(v) => updateGoal(gi, { goal: v })}
                placeholder="예: 받침 있는 낱말을 정확히 읽고 쓸 수 있다"
                placeholderTextColor={NEUTRAL.textMuted}
                multiline
                style={styles.textarea}
              />
              {g.shortTerms.map((st, si) => (
                <View key={si} style={styles.stBox}>
                  <Text style={styles.stLabel}>단기 목표 {si + 1}</Text>
                  <TextInput
                    accessibilityLabel={`연간 목표 ${gi + 1} 단기 목표 ${si + 1}`}
                    value={st.goal}
                    onChangeText={(v) => updateShortTerm(gi, si, { goal: v })}
                    placeholder="단기 목표"
                    placeholderTextColor={NEUTRAL.textMuted}
                    style={styles.input}
                  />
                  <View style={styles.stRow}>
                    <TextInput
                      accessibilityLabel={`단기 목표 ${si + 1} 기간`}
                      value={st.period}
                      onChangeText={(v) => updateShortTerm(gi, si, { period: v })}
                      placeholder="기간 (예: 1분기)"
                      placeholderTextColor={NEUTRAL.textMuted}
                      style={[styles.input, styles.stHalf]}
                    />
                    <TextInput
                      accessibilityLabel={`단기 목표 ${si + 1} 평가 방법`}
                      value={st.evaluation}
                      onChangeText={(v) => updateShortTerm(gi, si, { evaluation: v })}
                      placeholder="평가 방법"
                      placeholderTextColor={NEUTRAL.textMuted}
                      style={[styles.input, styles.stHalf]}
                    />
                  </View>
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`연간 목표 ${gi + 1}에 단기 목표 추가`}
                onPress={() => addShortTerm(gi)}
                style={({ pressed }) => [styles.addLineBtn, pressed && styles.pressed]}
              >
                <Text style={styles.addLineText}>＋ 단기 목표 추가</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="연간 목표 추가"
            onPress={addGoal}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>＋ 연간 목표 추가</Text>
          </Pressable>
        </View>
      )}

      {step === 4 && (
        <View>
          <InfoBanner message="지원 서비스는 선택입니다. 없으면 비워두고 넘어가세요." />
          {supportServices.map((s, i) => (
            <View key={i} style={styles.goalCard}>
              <Text style={styles.goalNum}>지원 서비스 {i + 1}</Text>
              <Text style={styles.label}>서비스</Text>
              <TextInput
                accessibilityLabel={`지원 서비스 ${i + 1} 이름`}
                value={s.service}
                onChangeText={(v) => updateService(i, { service: v })}
                placeholder="예: 언어치료"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
              <View style={styles.stRow}>
                <TextInput
                  accessibilityLabel={`지원 서비스 ${i + 1} 제공자`}
                  value={s.provider}
                  onChangeText={(v) => updateService(i, { provider: v })}
                  placeholder="제공 기관/인력"
                  placeholderTextColor={NEUTRAL.textMuted}
                  style={[styles.input, styles.stHalf]}
                />
                <TextInput
                  accessibilityLabel={`지원 서비스 ${i + 1} 빈도`}
                  value={s.frequency}
                  onChangeText={(v) => updateService(i, { frequency: v })}
                  placeholder="예: 주 2회"
                  placeholderTextColor={NEUTRAL.textMuted}
                  style={[styles.input, styles.stHalf]}
                />
              </View>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="지원 서비스 추가"
            onPress={addService}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>＋ 지원 서비스 추가</Text>
          </Pressable>
        </View>
      )}

      {step === 5 && (
        <View>
          <InfoBanner message="전환계획은 만 13세 이상 학생에게만 표시됩니다." />
          <Text style={styles.label}>전환 목표 영역</Text>
          <View style={styles.pickWrap}>
            {TRANSITION_GOAL_AREAS.map((o) => (
              <CategoryChip
                key={o.value}
                emoji="🧭"
                label={o.label}
                selected={transitionGoalArea === o.value}
                onPress={() => setTransitionGoalArea(transitionGoalArea === o.value ? "" : o.value)}
              />
            ))}
          </View>
          <Text style={styles.label}>희망 진로</Text>
          <TextInput
            accessibilityLabel="희망 진로"
            value={transitionGoal}
            onChangeText={setTransitionGoal}
            placeholder="예: 바리스타 직업훈련 (진로·직업)"
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>전환 활동 계획 (줄바꿈으로 구분)</Text>
          <TextInput
            accessibilityLabel="전환 활동 계획. 줄바꿈으로 구분"
            value={transitionSteps}
            onChangeText={setTransitionSteps}
            placeholder={"직업체험(카페 실습)\n대중교통 이용 훈련"}
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>연계 기관</Text>
          <TextInput
            accessibilityLabel="연계 기관"
            value={transitionAgencies}
            onChangeText={setTransitionAgencies}
            placeholder="발달장애인 훈련센터, 지역 장애인복지관"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
        </View>
      )}

      {step === 6 && (
        <View>
          <Text style={styles.helpText}>입력 내용을 확인하고 저장하세요.</Text>
          <View style={styles.summary}>
            <SumRow k="학생" v={selectedStudent?.fullName ?? route.params.personName} />
            <SumRow k="학교 · 학년도" v={`${school || "-"} · ${academicYear || "-"}`} />
            <SumRow k="IEP 회의" v={meetingDate} />
            <SumRow
              k="연간 목표"
              v={`${annualGoals.filter((g) => g.area.trim() && g.goal.trim()).length}개`}
            />
            <SumRow
              k="지원 서비스"
              v={`${supportServices.filter((s) => s.service.trim()).length}개`}
            />
            <SumRow
              k="전환 계획"
              v={showTransition ? (transitionGoal.trim() ? "포함" : "미입력") : "해당 없음"}
            />
            <SumRow k="확인 요청 대상" v={isSelfConfirmingStage(lifeStage) ? "본인" : "보호자"} />
          </View>
          <InfoBanner message="IEP는 공식 문서입니다. 저장(제출) 시 보호자·당사자 확인 절차가 시작됩니다." />
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
  studentBanner: {
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
  stBox: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: NEUTRAL.bg,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    gap: SPACING.sm,
  },
  stLabel: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textMuted },
  stRow: { flexDirection: "row", gap: SPACING.sm },
  stHalf: { flex: 1 },
  addLineBtn: {
    marginTop: SPACING.sm,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: PRIMARY[400],
    borderStyle: "dashed",
  },
  addLineText: { fontSize: 14, fontWeight: "700", color: PRIMARY[700] },
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
