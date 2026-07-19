import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  guardianshipReportSchema,
  type GuardianType,
  type GuardianshipReportInput,
  type LegReportKind,
} from "@ongil/validation";
import { createGuardianshipReport, getLegClients, type LegClient } from "../lib/leg";
import { isSelfConfirmingStage } from "../lib/iep";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StepBar } from "../components/StepBar";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "GuardianshipReportWizard">;

const STEP_CAPS: Record<number, string> = {
  1: "대상·후견 유형",
  2: "관리 현황",
  3: "특이사항·기한",
  4: "확인·저장",
};

const TOTAL_STEPS = 4;

const REPORT_KIND_LABEL: Record<LegReportKind, string> = {
  initial: "최초 보고 (후견개시 재산목록)",
  periodic: "정기 보고",
};

const GUARDIAN_TYPE_LABEL: Record<GuardianType, string> = {
  adult: "성년후견",
  limited: "한정후견",
  specific: "특정후견",
  voluntary: "임의후견",
};

interface Draft {
  personId: string;
  reportKind: LegReportKind;
  periodStart: string;
  periodEnd: string;
  guardianType: GuardianType;
  guardianName: string;
  propertySummary: string;
  personalCareSummary: string;
  incidents: string;
  nextReportDue: string;
}

/**
 * W-18 후견감독보고서(LEG-001) 작성 4단계 위저드(사회복지사, 웹 GuardianshipReportWizard.tsx 이식).
 * 대상·후견 유형 → 재산관리/신상보호 현황 → 특이사항·다음 보고 예정일 → 확인·저장.
 * LEG-001은 성인기·노년기(만 19세 이상)부터만 작성 가능 — 그 외 단계 당사자를 선택하면 폼 대신
 * 진입 가드 안내로 대체한다(!isSelfConfirmingStage, 전환계획 가드와 방향이 반대). 공식 서류라
 * requires_confirmation=true — 제출 시 서버 트리거가 확인 주체(성년=본인, 미성년=보호자)를 지정한다.
 */
export function GuardianshipReportWizardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params?.personId;

  const [clients, setClients] = useState<LegClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId ?? "");
  const [reportKind, setReportKind] = useState<LegReportKind>("periodic");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [guardianType, setGuardianType] = useState<GuardianType>("adult");
  const [guardianName, setGuardianName] = useState("");
  const [propertySummary, setPropertySummary] = useState("");
  const [personalCareSummary, setPersonalCareSummary] = useState("");
  const [incidents, setIncidents] = useState("");
  const [nextReportDue, setNextReportDue] = useState("");

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>("leg-guardianship:draft");

  const client = clients.find((c) => c.personId === personId) ?? null;
  const blocked = client ? !isSelfConfirmingStage(client.lifeStage) : false;

  const [step, setStep] = useState(1);

  const snapshot = useCallback(
    (): Draft => ({
      personId,
      reportKind,
      periodStart,
      periodEnd,
      guardianType,
      guardianName,
      propertySummary,
      personalCareSummary,
      incidents,
      nextReportDue,
    }),
    [
      personId,
      reportKind,
      periodStart,
      periodEnd,
      guardianType,
      guardianName,
      propertySummary,
      personalCareSummary,
      incidents,
      nextReportDue,
    ]
  );

  const applyDraft = useCallback((d: Draft) => {
    setPersonId(d.personId);
    setReportKind(d.reportKind);
    setPeriodStart(d.periodStart);
    setPeriodEnd(d.periodEnd);
    setGuardianType(d.guardianType);
    setGuardianName(d.guardianName);
    setPropertySummary(d.propertySummary);
    setPersonalCareSummary(d.personalCareSummary);
    setIncidents(d.incidents);
    setNextReportDue(d.nextReportDue);
  }, []);

  useEffect(() => {
    void (async () => {
      setClients(await getLegClients());
      await checkRestore(applyDraft);
    })();
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [step, saveDraft, snapshot]);

  const buildInput = (): GuardianshipReportInput => ({
    report_kind: reportKind,
    report_period: { start: periodStart, end: periodEnd },
    guardian_type: guardianType,
    guardian_name: guardianName.trim(),
    property_management_summary: propertySummary.trim(),
    personal_care_summary: personalCareSummary.trim(),
    incidents: incidents.trim() || undefined,
    next_report_due: nextReportDue,
  });

  const canNext =
    (step === 1 &&
      Boolean(personId && !blocked && periodStart && periodEnd && guardianName.trim())) ||
    (step === 2 && Boolean(propertySummary.trim() && personalCareSummary.trim())) ||
    (step === 3 && Boolean(nextReportDue)) ||
    step === 4;

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => {
    if (step === 1) navigation.goBack();
    else setStep((s) => s - 1);
  };

  const submit = () =>
    run(async () => {
      if (!personId) return "당사자를 선택해주세요.";
      const input = buildInput();
      const parsed = guardianshipReportSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createGuardianshipReport(personId, parsed.data);
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
      <StepBar current={step} total={TOTAL_STEPS} label="후견감독보고서 작성" />
      <Text style={styles.stepCap}>
        {step}/{TOTAL_STEPS} · {STEP_CAPS[step]}
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      {step === 1 && (
        <View>
          {!paramPersonId ? (
            <>
              <Text style={styles.label}>대상 당사자</Text>
              {clients.length === 0 ? (
                <Text style={styles.muted}>
                  법률·권리(LEG) 권한이 있는 담당 당사자가 없습니다.
                </Text>
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
            <Text style={styles.clientBanner}>당사자: {route.params?.personName}</Text>
          )}

          {client ? (
            <View style={styles.stageRow}>
              <StageBadge lifeStage={client.lifeStage} />
            </View>
          ) : null}

          <Text style={styles.label}>보고 구분</Text>
          <View style={styles.pickWrap}>
            {(["periodic", "initial"] as const).map((k) => (
              <CategoryChip
                key={k}
                emoji="📄"
                label={REPORT_KIND_LABEL[k]}
                selected={reportKind === k}
                onPress={() => setReportKind(k)}
              />
            ))}
          </View>

          {blocked ? (
            <View style={styles.guard}>
              <Text style={styles.guardIcon}>🔏</Text>
              <Text style={styles.guardTitle}>성인기(만 19세) 이상부터 작성할 수 있습니다</Text>
              <Text style={styles.guardText}>
                후견감독보고서(LEG-001)는 성인기·노년기(만 19세 이상) 당사자를 대상으로 합니다. 이
                당사자는 아직 성인기 이전 단계라 대상이 아닙니다. 다른 당사자를 선택하세요.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.stRow}>
                <View style={styles.stHalf}>
                  <Text style={styles.label}>보고 시작일</Text>
                  <DateField
                    accessibilityLabel="보고 시작일. 예시 2026-01-01"
                    value={periodStart}
                    onChange={setPeriodStart}
                    max={periodEnd || undefined}
                    style={styles.input}
                  />
                </View>
                <View style={styles.stHalf}>
                  <Text style={styles.label}>보고 종료일</Text>
                  <DateField
                    accessibilityLabel="보고 종료일. 예시 2026-12-31"
                    value={periodEnd}
                    onChange={setPeriodEnd}
                    min={periodStart || undefined}
                    style={styles.input}
                  />
                </View>
              </View>
              <Text style={styles.label}>후견 유형</Text>
              <View style={styles.pickWrap}>
                {(["adult", "limited", "specific", "voluntary"] as const).map((t) => (
                  <CategoryChip
                    key={t}
                    emoji="⚖️"
                    label={GUARDIAN_TYPE_LABEL[t]}
                    selected={guardianType === t}
                    onPress={() => setGuardianType(t)}
                  />
                ))}
              </View>
              <Text style={styles.label}>후견인 성명</Text>
              <TextInput
                accessibilityLabel="후견인 성명"
                value={guardianName}
                onChangeText={setGuardianName}
                placeholder="예: 김후견"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
            </>
          )}
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.helpText}>
            보고 기간 동안의 재산관리·신상보호 수행 현황을 기록합니다. 법원 제출용 서술이므로
            구체적으로 작성하세요.
          </Text>
          <Text style={styles.label}>재산관리 현황</Text>
          <TextInput
            accessibilityLabel="재산관리 현황"
            value={propertySummary}
            onChangeText={setPropertySummary}
            placeholder="예금·부동산 등 재산 관리 내역, 지출·수입 관리 방식 등을 기록하세요."
            placeholderTextColor={NEUTRAL.textMuted}
            maxLength={3000}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>신상보호 현황</Text>
          <TextInput
            accessibilityLabel="신상보호 현황"
            value={personalCareSummary}
            onChangeText={setPersonalCareSummary}
            placeholder="주거·의료·복지서비스 이용 등 신상보호 관련 조치 현황을 기록하세요."
            placeholderTextColor={NEUTRAL.textMuted}
            maxLength={3000}
            multiline
            style={styles.textarea}
          />
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.label}>특이사항 (선택)</Text>
          <TextInput
            accessibilityLabel="특이사항"
            value={incidents}
            onChangeText={setIncidents}
            placeholder="보고 기간 중 발생한 특이사항·분쟁·변경사항 등을 기록하세요."
            placeholderTextColor={NEUTRAL.textMuted}
            maxLength={2000}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>다음 보고 예정일</Text>
          <DateField
            accessibilityLabel="다음 보고 예정일. 예시 2027-01-01"
            value={nextReportDue}
            onChange={setNextReportDue}
            style={styles.input}
          />
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={styles.helpText}>입력 내용을 확인하고 저장하세요.</Text>
          <View style={styles.summary}>
            <SumRow k="당사자" v={client?.fullName || route.params?.personName || "-"} />
            <SumRow k="보고 구분" v={REPORT_KIND_LABEL[reportKind]} />
            <SumRow k="후견 유형" v={GUARDIAN_TYPE_LABEL[guardianType]} />
            <SumRow k="후견인" v={guardianName.trim() || "-"} />
            <SumRow k="보고 기간" v={`${periodStart || "-"} ~ ${periodEnd || "-"}`} />
            <SumRow k="특이사항" v={incidents.trim() ? "있음" : "없음"} />
            <SumRow k="다음 보고 예정일" v={nextReportDue || "-"} />
            <SumRow
              k="확인 요청 대상"
              v={client && isSelfConfirmingStage(client.lifeStage) ? "본인" : "보호자"}
            />
          </View>
          <InfoBanner message="후견감독보고서는 공식 서류입니다. 저장(제출) 시 당사자·보호자 확인 절차가 시작됩니다." />
        </View>
      )}

      <WizardFooter
        onPrev={goPrev}
        onNext={!isLast ? goNext : undefined}
        onSubmit={isLast ? submit : undefined}
        nextDisabled={isLast ? blocked : !canNext}
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
    minHeight: 96,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: NEUTRAL.text,
    textAlignVertical: "top",
  },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  stRow: { flexDirection: "row", gap: SPACING.sm },
  stHalf: { flex: 1 },
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
  summary: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    padding: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: SPACING.md,
  },
  sumK: { fontSize: 14, color: NEUTRAL.textMuted },
  sumV: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text, flex: 1, textAlign: "right" },
});
