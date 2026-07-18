import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  advocacyConsultationSchema,
  type AdvocacyConsultationInput,
  type AdvocacyIssueType,
} from "@ongil/validation";
import { createAdvocacyConsultation, getLegClients, type LegClient } from "../lib/leg";
import { isSelfConfirmingStage } from "../lib/iep";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { ErrorBanner, InfoBanner, PrimaryButton } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "AdvocacyConsultationForm">;

const ISSUE_TYPE_LABEL: Record<AdvocacyIssueType, string> = {
  rights_violation: "인권침해",
  discrimination: "차별",
  abuse_suspected: "학대의심",
  other: "기타",
};

interface Draft {
  consultedAt: string;
  issueType: AdvocacyIssueType;
  content: string;
  actionTaken: string;
  referralAgency: string;
}

/** 현재 시각을 datetime-local 형식(YYYY-MM-DDTHH:mm)으로. 웹 nowLocal과 동일. */
function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/**
 * W-19 권익옹호 상담기록(LEG-002) 작성 — 단일 폼(웹 AdvocacyConsultationForm.tsx 이식).
 * 대상 당사자·상담 일시 → 상담 유형 → 상담 내용 → 취한 조치·연계 기관(선택).
 * LEG-002는 성인기·노년기(만 19세 이상)부터만 작성 가능 — 그 외 단계 당사자를 선택하면 진입 가드
 * 배너를 띄우고 저장을 막는다(상담 유형 select는 항상 노출). 일상 기록이라
 * requires_confirmation=false — 확인 절차 없이 저장된다. consultedAt이 record_date로 쓰인다.
 */
export function AdvocacyConsultationFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params?.personId;

  const [clients, setClients] = useState<LegClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId ?? "");
  const [consultedAt, setConsultedAt] = useState(nowLocal());
  const [issueType, setIssueType] = useState<AdvocacyIssueType>("rights_violation");
  const [content, setContent] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [referralAgency, setReferralAgency] = useState("");

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>(
    `leg-advocacy:draft:${personId}`
  );

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );
  const blocked = client ? !isSelfConfirmingStage(client.lifeStage) : false;

  const snapshot = useCallback(
    (): Draft => ({ consultedAt, issueType, content, actionTaken, referralAgency }),
    [consultedAt, issueType, content, actionTaken, referralAgency]
  );

  const applyDraft = useCallback((d: Draft) => {
    setConsultedAt(d.consultedAt);
    setIssueType(d.issueType);
    setContent(d.content);
    setActionTaken(d.actionTaken);
    setReferralAgency(d.referralAgency);
  }, []);

  useEffect(() => {
    void (async () => {
      setClients(await getLegClients());
    })();
  }, []);

  // 초기 진입 시 1회만 임시저장 복원 여부를 묻는다(당사자 전환 시 재프롬프트 방지).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void checkRestore(applyDraft);
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [saveDraft, snapshot]);

  const submit = () =>
    run(async () => {
      if (!personId) return "당사자를 선택해주세요.";
      if (blocked) return "권익옹호 상담기록은 성인기(만 19세) 이상 당사자에게만 작성할 수 있습니다.";
      const input: AdvocacyConsultationInput = {
        consultedAt,
        issueType,
        content: content.trim(),
        ...(actionTaken.trim() ? { actionTaken: actionTaken.trim() } : {}),
        ...(referralAgency.trim() ? { referralAgency: referralAgency.trim() } : {}),
      };
      const parsed = advocacyConsultationSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createAdvocacyConsultation(personId, parsed.data);
      if (res.error) return res.error;
      clearDraft();
      navigation.goBack();
    });

  if (!paramPersonId && clients.length === 0) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      >
        <Text style={styles.title}>권익옹호 상담기록 작성</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>담당 당사자가 없습니다.</Text>
          <Text style={styles.emptyHint}>
            보호자가 법률·권리(LEG) 도메인 작성 권한을 부여하면 해당 당사자의 상담기록을
            작성할 수 있습니다.
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
        권익옹호 상담기록 작성 <Text style={styles.code}>LEG-002</Text>
      </Text>
      <Text style={styles.sub}>
        인권침해·차별·학대의심 등 권익옹호 상담 내용을 기록합니다.
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      {!paramPersonId ? (
        <>
          <Text style={styles.label}>대상 당사자</Text>
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
        </>
      ) : (
        <Text style={styles.clientBanner}>당사자: {route.params?.personName}</Text>
      )}

      {client ? (
        <View style={styles.stageRow}>
          <StageBadge lifeStage={client.lifeStage} />
        </View>
      ) : null}

      <Text style={styles.label}>상담 일시</Text>
      <TextInput
        accessibilityLabel="상담 일시. 예시 2026-07-18T14:30"
        value={consultedAt}
        onChangeText={setConsultedAt}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={NEUTRAL.textMuted}
        style={styles.input}
      />

      {blocked ? (
        <View style={styles.guard}>
          <Text style={styles.guardIcon}>🔏</Text>
          <Text style={styles.guardTitle}>성인기(만 19세) 이상부터 작성할 수 있습니다</Text>
          <Text style={styles.guardText}>
            권익옹호 상담기록(LEG-002)은 성인기·노년기(만 19세 이상) 당사자를 대상으로 합니다. 이
            당사자는 아직 성인기 이전 단계라 대상이 아닙니다. 다른 당사자를 선택하세요.
          </Text>
        </View>
      ) : null}

      <Text style={styles.label}>상담 유형</Text>
      <View style={styles.pickWrap}>
        {(["rights_violation", "discrimination", "abuse_suspected", "other"] as const).map((t) => (
          <CategoryChip
            key={t}
            emoji="🗣️"
            label={ISSUE_TYPE_LABEL[t]}
            selected={issueType === t}
            onPress={() => setIssueType(t)}
          />
        ))}
      </View>

      <Text style={styles.label}>상담 내용</Text>
      <TextInput
        accessibilityLabel="상담 내용"
        value={content}
        onChangeText={setContent}
        placeholder="상담 경위, 당사자 진술, 확인된 권익 침해 정황 등을 구체적으로 기록하세요."
        placeholderTextColor={NEUTRAL.textMuted}
        maxLength={3000}
        multiline
        style={styles.textarea}
      />

      <Text style={styles.label}>취한 조치 (선택)</Text>
      <TextInput
        accessibilityLabel="취한 조치"
        value={actionTaken}
        onChangeText={setActionTaken}
        placeholder="상담 후 취한 조치·안내·후속 계획 등을 기록하세요."
        placeholderTextColor={NEUTRAL.textMuted}
        maxLength={2000}
        multiline
        style={styles.textarea}
      />

      <Text style={styles.label}>연계 기관 (선택)</Text>
      <TextInput
        accessibilityLabel="연계 기관"
        value={referralAgency}
        onChangeText={setReferralAgency}
        placeholder="예: 장애인권익옹호기관, 국가인권위원회"
        placeholderTextColor={NEUTRAL.textMuted}
        style={styles.input}
      />

      <InfoBanner message="권익옹호 상담기록은 일상 기록으로 확인 절차 없이 저장됩니다." />

      <View style={{ marginTop: SPACING.md }}>
        <PrimaryButton
          label="상담기록 저장"
          onPress={submit}
          loading={loading}
          disabled={!personId || blocked || !content.trim()}
        />
      </View>
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
  clientBanner: {
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
