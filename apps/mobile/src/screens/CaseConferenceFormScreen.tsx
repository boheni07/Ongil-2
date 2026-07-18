import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { caseConferenceNoteSchema, type CaseConferenceNoteInput } from "@ongil/validation";
import {
  createCaseConferenceNote,
  getCaseNoteClients,
  type CaseNoteClient,
} from "../lib/case-notes";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { ErrorBanner, InfoBanner, PrimaryButton } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SocialWorkerStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SocialWorkerStackParamList, "CaseConferenceForm">;

interface Draft {
  meetingDate: string;
  participantsText: string;
  discussion: string;
  decisions: string;
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
 * W-23 사례회의록(WEL-006) 작성 — 단일 폼(웹 CaseConferenceForm.tsx 이식, HandoverCompose 모델).
 * 대상 당사자 선택 → 회의 일시·참석자(쉼표 구분, 1명 이상) → 논의 내용 → 결정사항(선택).
 * WEL-006은 일상 기록이라 requires_confirmation=false — 확인 절차 없이 저장되고 당사자·보호자에게
 * 일반 알림만 발송된다(연령 가드 없음).
 */
export function CaseConferenceFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params?.personId;

  const [clients, setClients] = useState<CaseNoteClient[]>([]);
  const [personId, setPersonId] = useState(paramPersonId ?? "");
  const [meetingDate, setMeetingDate] = useState(nowLocal());
  const [participantsText, setParticipantsText] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [decisions, setDecisions] = useState("");

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>(`case-notes:draft:${personId}`);

  const client = useMemo(
    () => clients.find((c) => c.personId === personId) ?? null,
    [clients, personId]
  );

  const snapshot = useCallback(
    (): Draft => ({ meetingDate, participantsText, discussion, decisions }),
    [meetingDate, participantsText, discussion, decisions]
  );

  const applyDraft = useCallback((d: Draft) => {
    setMeetingDate(d.meetingDate);
    setParticipantsText(d.participantsText);
    setDiscussion(d.discussion);
    setDecisions(d.decisions);
  }, []);

  useEffect(() => {
    void (async () => {
      setClients(await getCaseNoteClients());
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
      const participants = participantsText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (participants.length === 0) return "참석자를 1명 이상 입력해주세요.";
      const input: CaseConferenceNoteInput = {
        meetingDate,
        participants,
        discussion: discussion.trim(),
        ...(decisions.trim() ? { decisions: decisions.trim() } : {}),
      };
      const parsed = caseConferenceNoteSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createCaseConferenceNote(personId, parsed.data);
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
        <Text style={styles.title}>사례회의록 작성</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>담당 당사자가 없습니다.</Text>
          <Text style={styles.emptyHint}>
            보호자가 복지서비스(WEL) 도메인 작성 권한을 부여하면 해당 당사자의 사례회의록을
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
        사례회의록 작성 <Text style={styles.code}>WEL-006</Text>
      </Text>
      <Text style={styles.sub}>
        ISP 수립·재사정 논의 내용과 결정사항을 기록합니다. 확인 절차 없이 바로 저장됩니다.
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

      <Text style={styles.label}>회의 일시</Text>
      <TextInput
        accessibilityLabel="회의 일시. 예시 2026-07-18T14:30"
        value={meetingDate}
        onChangeText={setMeetingDate}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={NEUTRAL.textMuted}
        style={styles.input}
      />

      <Text style={styles.label}>참석자 (쉼표로 구분)</Text>
      <TextInput
        accessibilityLabel="참석자. 쉼표로 구분"
        value={participantsText}
        onChangeText={setParticipantsText}
        placeholder="예: 김사회복지사, 이보호자, 박특수교사"
        placeholderTextColor={NEUTRAL.textMuted}
        style={styles.input}
      />

      <Text style={styles.label}>논의 내용</Text>
      <TextInput
        accessibilityLabel="논의 내용"
        value={discussion}
        onChangeText={setDiscussion}
        placeholder="회의에서 논의한 내용을 기록하세요."
        placeholderTextColor={NEUTRAL.textMuted}
        maxLength={3000}
        multiline
        style={styles.textarea}
      />

      <Text style={styles.label}>결정사항 (선택)</Text>
      <TextInput
        accessibilityLabel="결정사항"
        value={decisions}
        onChangeText={setDecisions}
        placeholder="회의에서 결정된 사항을 기록하세요."
        placeholderTextColor={NEUTRAL.textMuted}
        maxLength={2000}
        multiline
        style={styles.textarea}
      />

      <InfoBanner message="사례회의록은 확인 절차 없이 저장되며, 당사자·보호자에게 등록 알림이 발송됩니다." />

      <View style={{ marginTop: SPACING.md }}>
        <PrimaryButton
          label="사례회의록 저장"
          onPress={submit}
          loading={loading}
          disabled={!personId || !participantsText.trim() || !discussion.trim()}
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
