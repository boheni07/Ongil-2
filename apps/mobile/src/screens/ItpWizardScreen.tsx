import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { itpSchema, type ItpInput } from "@ongil/validation";
import { createItp, getItpClients, type ItpClient } from "../lib/itp";
import { isItpActiveStage, isSelfConfirmingStage } from "../lib/iep";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StepBar } from "../components/StepBar";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TeacherStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TeacherStackParamList, "ItpWizard">;

const STEP_CAPS: Record<number, string> = {
  1: "대상·흥미영역",
  2: "현장실습 이력",
  3: "인계메모·검토일",
  4: "확인·저장",
};

const TOTAL_STEPS = 4;

interface ExperienceDraft {
  activity: string;
  start: string;
  end: string;
  note: string;
}

interface Draft {
  personId: string;
  areasText: string;
  experiences: ExperienceDraft[];
  nextStepNote: string;
  nextReviewDate: string;
}

function emptyExperience(): ExperienceDraft {
  return { activity: "", start: "", end: "", note: "" };
}

/**
 * T-19 개별화전환계획(ITP, EDU-005) 작성 4단계 위저드(특수교사, 웹 ItpWizard.tsx 이식).
 * 대상·진로 흥미영역 → 현장실습 이력 → 인계메모·검토일 → 확인·저장.
 * ITP는 청소년 전환기(만 13~18세)에만 활성 — 그 외 단계는 폼 대신 진입 가드 안내로 막는다
 * (isItpActiveStage, TRA-001 전환계획의 진입 가드와 동형). 매 제출은 새 레코드 INSERT다.
 * 공식 지원계획 문서라 requires_confirmation=true — 제출 시 서버 트리거가 확인 주체를 자동 지정한다.
 */
export function ItpWizardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params?.personId;

  const [clients, setClients] = useState<ItpClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId ?? "");
  const [areasText, setAreasText] = useState("");
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([emptyExperience()]);
  const [nextStepNote, setNextStepNote] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>("itp:draft");

  const client = clients.find((c) => c.personId === personId) ?? null;
  const blocked = client ? !isItpActiveStage(client.lifeStage) : false;

  const [step, setStep] = useState(1);

  const snapshot = useCallback(
    (): Draft => ({
      personId,
      areasText,
      experiences,
      nextStepNote,
      nextReviewDate,
    }),
    [personId, areasText, experiences, nextStepNote, nextReviewDate]
  );

  const applyDraft = useCallback((d: Draft) => {
    setPersonId(d.personId);
    setAreasText(d.areasText);
    setExperiences(
      Array.isArray(d.experiences) && d.experiences.length ? d.experiences : [emptyExperience()]
    );
    setNextStepNote(d.nextStepNote);
    setNextReviewDate(d.nextReviewDate);
  }, []);

  useEffect(() => {
    void (async () => {
      setClients(await getItpClients());
      await checkRestore(applyDraft);
    })();
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [step, saveDraft, snapshot]);

  const updateExperience = (i: number, patch: Partial<ExperienceDraft>) =>
    setExperiences((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const addExperience = () => setExperiences((prev) => [...prev, emptyExperience()]);
  const removeExperience = (i: number) =>
    setExperiences((prev) => prev.filter((_, idx) => idx !== i));

  const buildInput = (): ItpInput => {
    const areas = areasText
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const workExperienceLog = experiences
      .filter((e) => e.activity.trim())
      .map((e) => ({
        activity: e.activity.trim(),
        period: { start: e.start.trim(), end: e.end.trim() },
        note: e.note.trim() || undefined,
      }));

    return {
      career_interest_areas: areas,
      work_experience_log: workExperienceLog,
      next_step_note: nextStepNote.trim() || undefined,
      next_review_date: nextReviewDate.trim(),
    };
  };

  const canNext =
    (step === 1 && Boolean(personId && !blocked && areasText.trim())) ||
    step === 2 ||
    (step === 3 && Boolean(nextReviewDate));

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goPrev = () => {
    if (step === 1) navigation.goBack();
    else setStep((s) => s - 1);
  };

  const submit = () =>
    run(async () => {
      if (!personId) return "학생을 선택해주세요.";
      const input = buildInput();
      const parsed = itpSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createItp(personId, input);
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
      <StepBar current={step} total={TOTAL_STEPS} label="개별화전환계획 작성" />
      <Text style={styles.stepCap}>
        {step}/{TOTAL_STEPS} · {STEP_CAPS[step]}
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      {client?.latestItp ? (
        <View style={styles.latestCard}>
          <Text style={styles.latestTitle}>기존 ITP</Text>
          <Text style={styles.latestMeta}>
            다음 검토일 {client.latestItp.nextReviewDate ?? "-"}
            {client.latestItp.requiresConfirmation
              ? client.latestItp.confirmedAt
                ? " · 확인 완료됨"
                : " · 확인 대기 중"
              : ""}
            {" · 아래에서 새 ITP를 작성하면 별도 기록으로 저장됩니다."}
          </Text>
        </View>
      ) : null}

      {step === 1 && (
        <View>
          {!paramPersonId ? (
            <>
              <Text style={styles.label}>대상 학생</Text>
              {clients.length === 0 ? (
                <Text style={styles.muted}>
                  교육(EDU) 도메인 작성 권한이 있는 담당 학생이 없습니다.
                </Text>
              ) : (
                <View style={styles.pickWrap}>
                  {clients.map((c) => (
                    <CategoryChip
                      key={c.personId}
                      emoji="🧑‍🎓"
                      label={c.fullName}
                      selected={personId === c.personId}
                      onPress={() => setPersonId(c.personId)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.clientBanner}>학생: {route.params?.personName}</Text>
          )}

          {client ? (
            <View style={styles.stageRow}>
              <StageBadge lifeStage={client.lifeStage} />
            </View>
          ) : null}

          {blocked ? (
            <View style={styles.guard}>
              <Text style={styles.guardIcon}>🎓</Text>
              <Text style={styles.guardTitle}>
                청소년 전환기(만 13~18세)에만 작성할 수 있습니다
              </Text>
              <Text style={styles.guardText}>
                개별화전환계획(ITP)은 청소년 전환기 학생을 대상으로 합니다. 이 학생은 해당 단계가
                아닙니다. 다른 학생을 선택하세요.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>진로 흥미영역 (쉼표로 구분)</Text>
              <TextInput
                accessibilityLabel="진로 흥미영역. 쉼표로 구분"
                value={areasText}
                onChangeText={setAreasText}
                placeholder="예: 바리스타, 원예, 사무보조"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
            </>
          )}
        </View>
      )}

      {step === 2 && (
        <View>
          <InfoBanner message="현장실습·직업체험 이력은 선택입니다. 없으면 비워두고 넘어가세요." />
          {experiences.map((e, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardNum}>실습 {i + 1}</Text>
                {experiences.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`실습 ${i + 1} 삭제`}
                    onPress={() => removeExperience(i)}
                    hitSlop={8}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeText}>삭제</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.label}>실습/체험 활동명</Text>
              <TextInput
                accessibilityLabel={`실습 ${i + 1} 활동명`}
                value={e.activity}
                onChangeText={(v) => updateExperience(i, { activity: v })}
                placeholder="예: 카페 현장실습"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
              <View style={styles.stRow}>
                <View style={styles.stHalf}>
                  <Text style={styles.label}>시작일</Text>
                  <TextInput
                    accessibilityLabel={`실습 ${i + 1} 시작일`}
                    value={e.start}
                    onChangeText={(v) => updateExperience(i, { start: v })}
                    placeholder="예: 2026-03"
                    placeholderTextColor={NEUTRAL.textMuted}
                    style={styles.input}
                  />
                </View>
                <View style={styles.stHalf}>
                  <Text style={styles.label}>종료일</Text>
                  <TextInput
                    accessibilityLabel={`실습 ${i + 1} 종료일`}
                    value={e.end}
                    onChangeText={(v) => updateExperience(i, { end: v })}
                    placeholder="예: 2026-08"
                    placeholderTextColor={NEUTRAL.textMuted}
                    style={styles.input}
                  />
                </View>
              </View>
              <Text style={styles.label}>비고 (선택)</Text>
              <TextInput
                accessibilityLabel={`실습 ${i + 1} 비고`}
                value={e.note}
                onChangeText={(v) => updateExperience(i, { note: v })}
                placeholder="특이사항"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
              />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="실습 이력 추가"
            onPress={addExperience}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Text style={styles.addBtnText}>＋ 실습 이력 추가</Text>
          </Pressable>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.label}>성인기 인계 메모 (선택)</Text>
          <TextInput
            accessibilityLabel="성인기 인계 메모"
            value={nextStepNote}
            onChangeText={setNextStepNote}
            placeholder="성인기 전환 시 복지기관(TRA-001)에 전달할 참고 사항을 기록하세요."
            placeholderTextColor={NEUTRAL.textMuted}
            maxLength={2000}
            multiline
            style={styles.textarea}
          />
          <Text style={styles.label}>다음 검토일</Text>
          <DateField
            accessibilityLabel="다음 검토일. 예시 2027-03-01"
            value={nextReviewDate}
            onChange={setNextReviewDate}
            style={styles.input}
          />
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={styles.helpText}>입력 내용을 확인하고 저장하세요.</Text>
          <View style={styles.summary}>
            <SumRow k="학생" v={client?.fullName || route.params?.personName || "-"} />
            <SumRow k="진로 흥미영역" v={areasText.trim() || "-"} />
            <SumRow
              k="현장실습 이력"
              v={`${experiences.filter((e) => e.activity.trim()).length}건`}
            />
            <SumRow k="다음 검토일" v={nextReviewDate || "-"} />
            <SumRow
              k="확인 요청 대상"
              v={client && isSelfConfirmingStage(client.lifeStage) ? "본인" : "보호자"}
            />
          </View>
          <InfoBanner message="개별화전환계획은 공식 문서입니다. 저장(제출) 시 당사자·보호자 확인 절차가 시작됩니다." />
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
  removeBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: SPACING.sm },
  removeText: { fontSize: 13, fontWeight: "700", color: NEUTRAL.danger },
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
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: SPACING.md,
  },
  sumK: { fontSize: 14, color: NEUTRAL.textMuted },
  sumV: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text, flex: 1, textAlign: "right" },
});
