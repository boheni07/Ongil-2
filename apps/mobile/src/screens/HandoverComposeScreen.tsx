import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { handoverNoteSchema, type HandoverPriority } from "@ongil/validation";
import { getServiceablePersons } from "../lib/journal";
import { createHandover, getHandoverTargets, type HandoverTarget } from "../lib/handover";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { CategoryChip } from "../components/IconSelector";
import { ErrorBanner, InfoBanner, PrimaryButton } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SupporterStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SupporterStackParamList, "HandoverCompose">;

const PRIORITY_CHOICES: { value: HandoverPriority; label: string; emoji: string }[] = [
  { value: "high", label: "중요", emoji: "🔴" },
  { value: "normal", label: "보통", emoji: "🟢" },
  { value: "low", label: "참고", emoji: "⚪" },
];

/** S-21 인수인계 작성 — 당사자 → 대상 지원사 → 내용/중요도. docs/04-workflow.md Flow-S-02. */
export function HandoverComposeScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const paramPersonId = route.params?.personId;

  const [persons, setPersons] = useState<{ id: string; fullName: string }[]>([]);
  const [personId, setPersonId] = useState(paramPersonId ?? "");
  const [targets, setTargets] = useState<HandoverTarget[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<HandoverPriority>("normal");

  const { loading, error, setError, run } = useAsyncAction();

  useEffect(() => {
    void (async () => {
      setPersons(await getServiceablePersons());
    })();
  }, []);

  // 당사자 선택 시 대상 지원사 후보 갱신(선택 초기화).
  const loadTargets = useCallback(async (pid: string) => {
    setToUserId("");
    if (!pid) {
      setTargets([]);
      return;
    }
    setTargets(await getHandoverTargets(pid));
  }, []);

  useEffect(() => {
    void loadTargets(personId);
  }, [personId, loadTargets]);

  const submit = () =>
    run(async () => {
      const parsed = handoverNoteSchema.safeParse({ toUserId, content: content.trim(), priority });
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createHandover(personId, parsed.data);
      if (res.error) return res.error;
      navigation.goBack();
    });

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.label}>당사자 선택</Text>
      {persons.length === 0 ? (
        <Text style={styles.muted}>연결된 당사자가 없습니다.</Text>
      ) : (
        <View style={styles.pickWrap}>
          {persons.map((p) => (
            <CategoryChip
              key={p.id}
              emoji="🧑"
              label={p.fullName}
              selected={personId === p.id}
              onPress={() => {
                setError(null);
                setPersonId(p.id);
              }}
            />
          ))}
        </View>
      )}

      {personId ? (
        <>
          <Text style={[styles.label, { marginTop: SPACING.lg }]}>대상 지원사 선택</Text>
          {targets.length === 0 ? (
            <InfoBanner message="이 당사자에게 인계할 다른 지원사가 없습니다." />
          ) : (
            <View style={styles.pickWrap}>
              {targets.map((t) => (
                <CategoryChip
                  key={t.userId}
                  emoji="👤"
                  label={t.fullName ?? "담당자"}
                  selected={toUserId === t.userId}
                  onPress={() => setToUserId(t.userId)}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>중요도</Text>
      <View style={styles.pickWrap}>
        {PRIORITY_CHOICES.map((c) => (
          <CategoryChip
            key={c.value}
            emoji={c.emoji}
            label={c.label}
            selected={priority === c.value}
            onPress={() => setPriority(c.value)}
          />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: SPACING.lg }]}>인계 내용</Text>
      <TextInput
        accessibilityLabel="인계 내용"
        value={content}
        onChangeText={setContent}
        placeholder="다음 지원사가 참고할 내용을 입력하세요."
        placeholderTextColor={NEUTRAL.textMuted}
        multiline
        style={styles.textarea}
      />

      <View style={{ marginTop: SPACING.lg }}>
        <PrimaryButton
          label="인수인계 남기기"
          onPress={submit}
          loading={loading}
          disabled={!personId || !toUserId || !content.trim()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  label: { fontSize: 15, fontWeight: "600", color: NEUTRAL.text, marginBottom: SPACING.sm },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: NEUTRAL.text,
    textAlignVertical: "top",
  },
});
