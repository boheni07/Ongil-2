import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ispSchema } from "@ongil/validation";
import { createIsp, getSocialWorkerClients, isSelfConfirmingStage, type SocialWorkerClient } from "../lib/isp";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StepBar } from "../components/StepBar";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { Card } from "../components/Card";
import { DOMAIN_COLORS, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

const WEL = DOMAIN_COLORS.WEL;

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "IspWizard">;

interface Goal {
  area: string;
  longTerm: string;
  shortTerm: string;
  responsible: string;
  deadline: string;
}
interface Service {
  service: string;
  provider: string;
  frequency: string;
  start: string;
}

interface Draft {
  personId: string;
  caseManager: string;
  periodStart: string;
  periodEnd: string;
  reassessmentDate: string;
  needAreas: string[];
  needStatement: string;
  assessmentTool: string;
  goals: Goal[];
  services: Service[];
}

/** 주요 욕구 영역 (프로토타입 W-13 Step2 복수 선택 칩). */
const NEED_AREAS = [
  "자립생활 지원",
  "사회참여 확대",
  "직업훈련·고용",
  "건강관리",
  "여가·문화활동",
  "가족지원",
];

/** 사정 도구/근거 셀렉트 옵션 (프로토타입 W-13 Step2). */
const ASSESSMENT_TOOLS = [
  "ICF 기반 기능평가",
  "지역사회적응검사(CIS-A)",
  "일상생활수행능력(ADL) 평가",
];

const STEP_CAPS: Record<number, string> = {
  1: "기본 정보",
  2: "욕구 사정",
  3: "목표 영역",
  4: "서비스 계획",
  5: "확인 · 제출",
};

const TOTAL_STEPS = 5;

function emptyGoal(): Goal {
  return { area: "", longTerm: "", shortTerm: "", responsible: "", deadline: "" };
}
function emptyService(): Service {
  return { service: "", provider: "", frequency: "", start: "" };
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
/** 오늘부터 months개월 뒤 YYYY-MM-DD. */
function isoPlusMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** W-13 ISP 작성 5단계 위저드. 대상 당사자 파라미터가 없으면 1단계에서 화면 내 선택. */
export function IspWizardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params.personId;

  const [clients, setClients] = useState<SocialWorkerClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId);
  const [caseManager, setCaseManager] = useState("");
  const [periodStart, setPeriodStart] = useState(todayISO());
  const [periodEnd, setPeriodEnd] = useState(isoPlusMonths(12));
  const [reassessmentDate, setReassessmentDate] = useState(isoPlusMonths(6));
  const [needAreas, setNeedAreas] = useState<string[]>([]);
  const [needStatement, setNeedStatement] = useState("");
  const [assessmentTool, setAssessmentTool] = useState("");
  const [goals, setGoals] = useState<Goal[]>([emptyGoal()]);
  const [services, setServices] = useState<Service[]>([emptyService()]);

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>("isp:draft");

  const selectedClient = clients.find((c) => c.personId === personId) ?? null;

  const [step, setStep] = useState(1);

  const snapshot = useCallback(
    (): Draft => ({
      personId,
      caseManager,
      periodStart,
      periodEnd,
      reassessmentDate,
      needAreas,
      needStatement,
      assessmentTool,
      goals,
      services,
    }),
    [personId, caseManager, periodStart, periodEnd, reassessmentDate, needAreas, needStatement, assessmentTool, goals, services]
  );

  const applyDraft = useCallback((d: Draft) => {
    setPersonId(d.personId);
    setCaseManager(d.caseManager);
    setPeriodStart(d.periodStart);
    setPeriodEnd(d.periodEnd);
    setReassessmentDate(d.reassessmentDate);
    setNeedAreas(Array.isArray(d.needAreas) ? d.needAreas : []);
    setNeedStatement(d.needStatement);
    setAssessmentTool(d.assessmentTool);
    setGoals(d.goals.length ? d.goals : [emptyGoal()]);
    setServices(d.services.length ? d.services : [emptyService()]);
  }, []);

  useEffect(() => {
    void (async () => {
      setClients(await getSocialWorkerClients());
      await checkRestore(applyDraft);
    })();
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [step, saveDraft, snapshot]);

  const toggleNeedArea = (area: string) =>
    setNeedAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));

  const updateGoal = (i: number, patch: Partial<Goal>) =>
    setGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const addGoal = () => setGoals((prev) => [...prev, emptyGoal()]);

  const updateService = (i: number, patch: Partial<Service>) =>
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addService = () => setServices((prev) => [...prev, emptyService()]);

  const buildInput = () => ({
    personId,
    service_period: { start: periodStart.trim(), end: periodEnd.trim() },
    reassessment_date: reassessmentDate.trim(),
    case_manager: caseManager.trim(),
    assessment_tool: assessmentTool.trim() || undefined,
    // 선택된 욕구 영역 칩 하나당 한 need 항목. needs 진술은 칩 간 공유(프로토타입 구조).
    needs: needAreas.map((area) => ({
      area,
      needs: needStatement.trim(),
      barriers: "",
    })),
    goals: goals
      .filter((g) => g.area.trim() || g.longTerm.trim() || g.shortTerm.trim())
      .map((g) => ({
        area: g.area.trim(),
        long_term: g.longTerm.trim(),
        short_term: g.shortTerm.trim(),
        responsible: g.responsible.trim(),
        deadline: g.deadline.trim(),
      })),
    services: services
      .filter((s) => s.service.trim() || s.provider.trim() || s.frequency.trim())
      .map((s) => ({
        service: s.service.trim(),
        provider: s.provider.trim(),
        frequency: s.frequency.trim(),
        start: s.start.trim(),
      })),
  });

  const dateOk = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const canNext =
    (step === 1 &&
      Boolean(personId) &&
      caseManager.trim() &&
      dateOk(periodStart) &&
      dateOk(periodEnd) &&
      dateOk(reassessmentDate)) ||
    step === 2 ||
    (step === 3 && goals.some((g) => g.area.trim() && g.longTerm.trim())) ||
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
      const parsed = ispSchema.safeParse((({ personId: _pid, ...rest }) => rest)(input));
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createIsp(input);
      if (res.error) return res.error;
      clearDraft();
      if (res.recordId) navigation.replace("IspReview", { recordId: res.recordId });
      else navigation.goBack();
    });

  const isLast = step === TOTAL_STEPS;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepBar current={step} total={TOTAL_STEPS} label="ISP 작성" />
      <Text style={styles.stepCap}>
        {step}/{TOTAL_STEPS} · {STEP_CAPS[step]}
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      {step === 1 && (
        <Card>
          {!paramPersonId ? (
            <>
              <Text style={styles.label}>대상 당사자</Text>
              {clients.length === 0 ? (
                <Text style={styles.muted}>담당 당사자가 없습니다.</Text>
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
          <Text style={styles.label}>담당자 (사례관리자)</Text>
          <TextInput
            accessibilityLabel="담당자 사례관리자"
            value={caseManager}
            onChangeText={setCaseManager}
            placeholder="예: 최복지"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>지원 시작일</Text>
          <DateField
            accessibilityLabel="지원 시작일. 예시 2026-01-15"
            value={periodStart}
            onChange={setPeriodStart}
            max={periodEnd || undefined}
            style={styles.input}
          />
          <Text style={styles.label}>지원 종료일</Text>
          <DateField
            accessibilityLabel="지원 종료일. 예시 2026-12-31"
            value={periodEnd}
            onChange={setPeriodEnd}
            min={periodStart || undefined}
            style={styles.input}
          />
          <Text style={styles.label}>재사정 예정일</Text>
          <DateField
            accessibilityLabel="재사정 예정일. 예시 2026-08-07"
            value={reassessmentDate}
            onChange={setReassessmentDate}
            style={styles.input}
          />
          <Text style={styles.hint}>재사정 예정일이 30일 이내로 다가오면 D-30 경고가 표시됩니다.</Text>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <Text style={styles.label}>주요 욕구 영역 (복수 선택)</Text>
          <View style={styles.pickWrap}>
            {NEED_AREAS.map((area) => (
              <CategoryChip
                key={area}
                emoji="🎯"
                label={area}
                selected={needAreas.includes(area)}
                onPress={() => toggleNeedArea(area)}
              />
            ))}
          </View>
          <Text style={styles.label}>당사자·가족 욕구 진술</Text>
          <TextInput
            accessibilityLabel="당사자 가족 욕구 진술"
            value={needStatement}
            onChangeText={setNeedStatement}
            placeholder="당사자와 가족이 표현한 욕구를 기록하세요"
            placeholderTextColor={NEUTRAL.textMuted}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>사정 도구 / 근거</Text>
          <View style={styles.pickWrap}>
            {ASSESSMENT_TOOLS.map((tool) => (
              <CategoryChip
                key={tool}
                emoji="📊"
                label={tool}
                selected={assessmentTool === tool}
                onPress={() => setAssessmentTool((prev) => (prev === tool ? "" : tool))}
              />
            ))}
          </View>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Text style={styles.helpText}>목표 영역별로 장·단기 목표와 담당·기한을 설정하세요.</Text>
          {goals.map((g, gi) => (
            <View key={gi} style={styles.goalCard}>
              <Text style={styles.goalNum}>목표 {gi + 1}</Text>
              <Text style={styles.label}>영역</Text>
              <TextInput
                accessibilityLabel={`목표 ${gi + 1} 영역`}
                value={g.area}
                onChangeText={(v) => updateGoal(gi, { area: v })}
                placeholder="예: 자립생활"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>장기 목표</Text>
              <TextInput
                accessibilityLabel={`목표 ${gi + 1} 장기 목표`}
                value={g.longTerm}
                onChangeText={(v) => updateGoal(gi, { longTerm: v })}
                placeholder="예: 지역사회 내 독립적 일상생활 수행"
                placeholderTextColor={NEUTRAL.textMuted}
                multiline
                style={styles.textarea}
              />
              <Text style={styles.label}>단기 목표</Text>
              <TextInput
                accessibilityLabel={`목표 ${gi + 1} 단기 목표`}
                value={g.shortTerm}
                onChangeText={(v) => updateGoal(gi, { shortTerm: v })}
                placeholder="예: 대중교통 단독 이용 훈련"
                placeholderTextColor={NEUTRAL.textMuted}
                multiline
                style={styles.textarea}
              />
              <View style={styles.stRow}>
                <View style={styles.stHalf}>
                  <Text style={styles.label}>담당</Text>
                  <TextInput
                    accessibilityLabel={`목표 ${gi + 1} 담당`}
                    value={g.responsible}
                    onChangeText={(v) => updateGoal(gi, { responsible: v })}
                    placeholder="담당 인력/기관"
                    placeholderTextColor={NEUTRAL.textMuted}
                    style={styles.input}
                  />
                </View>
                <View style={styles.stHalf}>
                  <Text style={styles.label}>기한</Text>
                  <TextInput
                    accessibilityLabel={`목표 ${gi + 1} 기한`}
                    value={g.deadline}
                    onChangeText={(v) => updateGoal(gi, { deadline: v })}
                    placeholder="예: 2026-09"
                    placeholderTextColor={NEUTRAL.textMuted}
                    style={styles.input}
                  />
                </View>
              </View>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="목표 추가"
            onPress={addGoal}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>＋ 목표 추가</Text>
          </Pressable>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <InfoBanner message="서비스 계획은 선택입니다. 없으면 비워두고 넘어가세요." />
          {services.map((s, i) => (
            <View key={i} style={styles.goalCard}>
              <Text style={styles.goalNum}>서비스 {i + 1}</Text>
              <Text style={styles.label}>서비스</Text>
              <TextInput
                accessibilityLabel={`서비스 ${i + 1} 이름`}
                value={s.service}
                onChangeText={(v) => updateService(i, { service: v })}
                placeholder="예: 주간활동 서비스"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
              <View style={styles.stRow}>
                <TextInput
                  accessibilityLabel={`서비스 ${i + 1} 제공기관`}
                  value={s.provider}
                  onChangeText={(v) => updateService(i, { provider: v })}
                  placeholder="제공 기관"
                  placeholderTextColor={NEUTRAL.textMuted}
                  style={[styles.input, styles.stHalf]}
                />
                <TextInput
                  accessibilityLabel={`서비스 ${i + 1} 빈도`}
                  value={s.frequency}
                  onChangeText={(v) => updateService(i, { frequency: v })}
                  placeholder="예: 주 3회"
                  placeholderTextColor={NEUTRAL.textMuted}
                  style={[styles.input, styles.stHalf]}
                />
              </View>
              <Text style={styles.label}>시작일</Text>
              <DateField
                accessibilityLabel={`서비스 ${i + 1} 시작일`}
                value={s.start}
                onChange={(v) => updateService(i, { start: v })}
                style={styles.input}
              />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="서비스 추가"
            onPress={addService}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>＋ 서비스 추가</Text>
          </Pressable>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <Text style={styles.helpText}>입력 내용을 확인하고 제출하세요.</Text>
          <View style={styles.summary}>
            <SumRow k="당사자" v={selectedClient?.fullName || route.params.personName || "-"} />
            <SumRow k="담당자" v={caseManager || "-"} />
            <SumRow k="지원 기간" v={`${periodStart} ~ ${periodEnd}`} />
            <SumRow k="재사정 예정" v={reassessmentDate} />
            <SumRow k="욕구 영역" v={needAreas.length ? `${needAreas.length}개` : "미선택"} />
            <SumRow k="목표" v={`${goals.filter((g) => g.area.trim() && g.longTerm.trim()).length}개`} />
            <SumRow k="서비스" v={`${services.filter((s) => s.service.trim()).length}개`} />
            <SumRow k="확인 요청 대상" v={selectedClient && isSelfConfirmingStage(selectedClient.lifeStage) ? "본인" : "보호자"} />
          </View>
          <InfoBanner message="ISP는 공식 문서입니다. 제출 시 당사자·보호자 확인 절차가 시작됩니다." />
        </Card>
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
    color: WEL.text,
    backgroundColor: WEL.bg,
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
  hint: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: 6 },
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
  stRow: { flexDirection: "row", gap: SPACING.sm },
  stHalf: { flex: 1 },
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
