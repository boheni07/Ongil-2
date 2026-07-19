import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { personRegisterSchema } from "@ongil/validation";
import { registerPerson } from "../lib/guardian";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StepBar } from "../components/StepBar";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { formatPhoneNumber } from "../lib/format";
import { Card } from "../components/Card";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "PersonRegister">;

const STEP_CAPS = ["기본 정보", "민감정보 동의", "장애 정보", "응급 정보", "프로필 사진", "확인"];
const DISABILITY_TYPES = [
  "지적장애",
  "자폐성장애",
  "지체장애",
  "뇌병변장애",
  "시각장애",
  "청각장애",
  "언어장애",
  "기타",
];
const GENDERS = [
  { value: "M", label: "남성" },
  { value: "F", label: "여성" },
  { value: "other", label: "기타" },
] as const;

interface Draft {
  fullName: string;
  birthDate: string;
  gender: "M" | "F" | "other" | null;
  consent: boolean;
  disabilityTypes: string[];
  disabilityDegree: "severe" | "mild" | null;
  allergies: string;
  medications: string;
  contactName: string;
  contactRelation: string;
  contactPhone: string;
}

/** Flow-G-01 당사자 등록 6단계 위저드. persons→guardians→consents 순차 저장(registerPerson). */
export function PersonRegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "other" | null>(null);
  const [consent, setConsent] = useState(false);
  const [disabilityTypes, setDisabilityTypes] = useState<string[]>([]);
  const [disabilityDegree, setDisabilityDegree] = useState<"severe" | "mild" | null>(null);
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRelation, setContactRelation] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>("register:draft");

  const snapshot = useCallback(
    (): Draft => ({
      fullName,
      birthDate,
      gender,
      consent,
      disabilityTypes,
      disabilityDegree,
      allergies,
      medications,
      contactName,
      contactRelation,
      contactPhone,
    }),
    [fullName, birthDate, gender, consent, disabilityTypes, disabilityDegree, allergies, medications, contactName, contactRelation, contactPhone]
  );

  const applyDraft = useCallback((d: Draft) => {
    setFullName(d.fullName);
    setBirthDate(d.birthDate);
    setGender(d.gender);
    setConsent(d.consent);
    setDisabilityTypes(d.disabilityTypes);
    setDisabilityDegree(d.disabilityDegree);
    setAllergies(d.allergies);
    setMedications(d.medications);
    setContactName(d.contactName);
    setContactRelation(d.contactRelation);
    setContactPhone(d.contactPhone);
  }, []);

  useEffect(() => {
    void checkRestore(applyDraft);
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [step, saveDraft, snapshot]);

  const splitList = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const buildInput = () => {
    const contacts =
      contactName.trim() && contactPhone.trim()
        ? [
            {
              name: contactName.trim(),
              relation: contactRelation.trim() || undefined,
              phone: contactPhone.trim(),
            },
          ]
        : [];
    const allergyList = splitList(allergies);
    const medList = splitList(medications);
    const emergencyInfo =
      allergyList.length || medList.length || contacts.length
        ? { allergies: allergyList, medications: medList, contacts }
        : undefined;
    return {
      fullName: fullName.trim(),
      birthDate: birthDate.trim(),
      gender: gender ?? undefined,
      sensitiveConsent: consent as true,
      disabilityTypes,
      disabilityDegree: disabilityDegree ?? undefined,
      emergencyInfo,
    };
  };

  const toggleType = (t: string) =>
    setDisabilityTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const canNext =
    (step === 1 && fullName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) ||
    (step === 2 && consent) ||
    step === 3 ||
    step === 4 ||
    step === 5;

  const submit = () =>
    run(async () => {
      const parsed = personRegisterSchema.safeParse(buildInput());
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await registerPerson(parsed.data);
      if (res.error && !res.ok) return res.error;
      clearDraft();
      if (res.error) Alert.alert("등록 완료", res.error);
      navigation.goBack();
    });

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepBar current={step} total={6} label="당사자 등록" />
      <Text style={styles.stepCap}>
        {step}/6 · {STEP_CAPS[step - 1]}
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      {step === 1 && (
        <Card>
          <Text style={styles.label}>이름 *</Text>
          <TextInput
            accessibilityLabel="이름"
            value={fullName}
            onChangeText={setFullName}
            placeholder="당사자 이름"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>생년월일 *</Text>
          <DateField
            accessibilityLabel="생년월일. 예시 2008-03-15"
            value={birthDate}
            onChange={setBirthDate}
            style={styles.input}
          />
          <Text style={styles.label}>성별 (선택)</Text>
          <View style={styles.pickWrap}>
            {GENDERS.map((g) => (
              <CategoryChip
                key={g.value}
                emoji="•"
                label={g.label}
                selected={gender === g.value}
                onPress={() => setGender(gender === g.value ? null : g.value)}
              />
            ))}
          </View>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <InfoBanner message="장애·건강정보는 민감정보입니다(PIPA §23). 보호자가 대리 동의합니다." />
          <Text style={styles.consentBody}>
            온길은 당사자의 장애정보, 건강정보, 응급정보 등 민감정보를 기록·이용합니다. 보호자로서
            민감정보 수집·이용에 동의하십니까?
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            accessibilityLabel="민감정보 수집·이용 동의"
            onPress={() => setConsent((v) => !v)}
            style={({ pressed }) => [styles.consentRow, consent && styles.consentRowOn, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, consent && styles.checkboxOn]}>
              {consent ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.consentLabel}>민감정보 수집·이용에 동의합니다.</Text>
          </Pressable>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <Text style={styles.label}>장애 유형 (복수 선택)</Text>
          <View style={styles.pickWrap}>
            {DISABILITY_TYPES.map((t) => (
              <CategoryChip
                key={t}
                emoji="•"
                label={t}
                selected={disabilityTypes.includes(t)}
                onPress={() => toggleType(t)}
              />
            ))}
          </View>
          <Text style={[styles.label, { marginTop: SPACING.lg }]}>장애 정도</Text>
          <View style={styles.pickWrap}>
            <CategoryChip emoji="•" label="심한 장애" selected={disabilityDegree === "severe"} onPress={() => setDisabilityDegree(disabilityDegree === "severe" ? null : "severe")} />
            <CategoryChip emoji="•" label="심하지 않은 장애" selected={disabilityDegree === "mild"} onPress={() => setDisabilityDegree(disabilityDegree === "mild" ? null : "mild")} />
          </View>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <Text style={styles.label}>알레르기 (쉼표로 구분)</Text>
          <TextInput
            accessibilityLabel="알레르기"
            value={allergies}
            onChangeText={setAllergies}
            placeholder="예) 땅콩, 페니실린"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>복용약 / 금기약물 (쉼표로 구분)</Text>
          <TextInput
            accessibilityLabel="복용약"
            value={medications}
            onChangeText={setMedications}
            placeholder="예) 발프로산"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <Text style={[styles.label, { marginTop: SPACING.lg }]}>비상 연락처</Text>
          <TextInput
            accessibilityLabel="비상 연락처 이름"
            value={contactName}
            onChangeText={setContactName}
            placeholder="이름"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="관계"
            value={contactRelation}
            onChangeText={setContactRelation}
            placeholder="관계 (예: 어머니)"
            placeholderTextColor={NEUTRAL.textMuted}
            style={[styles.input, { marginTop: SPACING.sm }]}
          />
          <TextInput
            accessibilityLabel="전화번호"
            value={contactPhone}
            onChangeText={(v) => setContactPhone(formatPhoneNumber(v))}
            placeholder="010-0000-0000"
            placeholderTextColor={NEUTRAL.textMuted}
            keyboardType="number-pad"
            maxLength={13}
            style={[styles.input, { marginTop: SPACING.sm }]}
          />
        </Card>
      )}

      {step === 5 && (
        <Card>
          <InfoBanner message="프로필 사진은 선택입니다. 사진 업로드는 준비 중이며, 건너뛰고 등록할 수 있습니다." />
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarEmoji}>🧑</Text>
          </View>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <Text style={styles.summaryTitle}>입력 내용을 확인하세요</Text>
          <SumRow k="이름" v={fullName.trim() || "-"} />
          <SumRow k="생년월일" v={birthDate.trim() || "-"} />
          <SumRow k="성별" v={GENDERS.find((g) => g.value === gender)?.label ?? "미입력"} />
          <SumRow k="민감정보 동의" v={consent ? "동의함" : "미동의"} />
          <SumRow k="장애 유형" v={disabilityTypes.length ? disabilityTypes.join(", ") : "미입력"} />
          <SumRow
            k="장애 정도"
            v={disabilityDegree === "severe" ? "심한 장애" : disabilityDegree === "mild" ? "심하지 않은 장애" : "미입력"}
          />
          <SumRow k="알레르기" v={allergies.trim() || "없음"} />
          <SumRow k="복용약" v={medications.trim() || "없음"} />
          <SumRow
            k="비상연락"
            v={contactName.trim() && contactPhone.trim() ? `${contactName.trim()} ${contactPhone.trim()}` : "미입력"}
          />
        </Card>
      )}

      <WizardFooter
        onPrev={step > 1 ? () => setStep((s) => s - 1) : () => navigation.goBack()}
        onNext={step < 6 ? () => setStep((s) => s + 1) : undefined}
        onSubmit={step === 6 ? submit : undefined}
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
  label: { fontSize: 15, fontWeight: "600", color: NEUTRAL.text, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: NEUTRAL.text,
  },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  consentBody: { fontSize: 15, lineHeight: 24, color: NEUTRAL.text, marginTop: SPACING.md, marginBottom: SPACING.lg },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
  },
  consentRowOn: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: PRIMARY[600], borderColor: PRIMARY[600] },
  checkMark: { color: "#fff", fontSize: 16, fontWeight: "800" },
  consentLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: NEUTRAL.text },
  pressed: { opacity: 0.85 },
  avatarPlaceholder: {
    alignSelf: "center",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: NEUTRAL.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xl,
  },
  avatarEmoji: { fontSize: 56 },
  summaryTitle: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.md },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, gap: SPACING.md, borderBottomWidth: 1, borderBottomColor: NEUTRAL.border },
  sumK: { fontSize: 14, color: NEUTRAL.textMuted },
  sumV: { flex: 1, fontSize: 14, fontWeight: "600", color: NEUTRAL.text, textAlign: "right" },
});
