import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OBSERVATION_TAG_CATALOG, observationSchema } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { createObservation } from "../lib/iep";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { CategoryChip } from "../components/IconSelector";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner } from "../components/ui";
import { formatDateTimeInput } from "../lib/format";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { TeacherStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<TeacherStackParamList, "ObservationForm">;

interface Draft {
  observedAt: string;
  situation: string;
  tags: string[];
  note: string;
  linkedGoalArea: string;
}

const TAG_CATEGORIES = Object.entries(OBSERVATION_TAG_CATALOG);

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** T-16 관찰기록 작성 — 4카테고리 태그칩 복수선택 + 최근 IEP 목표 연결(선택). */
export function ObservationFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { personId, personName } = route.params;

  const [observedAt, setObservedAt] = useState(nowLocal());
  const [situation, setSituation] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [linkedGoalArea, setLinkedGoalArea] = useState("");
  const [goalOptions, setGoalOptions] = useState<string[]>([]);

  const { loading, error, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>(`obs:draft:${personId}`);

  const applyDraft = useCallback((d: Draft) => {
    setObservedAt(d.observedAt);
    setSituation(d.situation);
    setTags(d.tags);
    setNote(d.note);
    setLinkedGoalArea(d.linkedGoalArea);
  }, []);

  useEffect(() => {
    void (async () => {
      // 최근 제출된 IEP의 목표 영역 라벨을 연결 옵션으로 제공(웹의 "영역 · 목표" 매칭 키와 동일).
      const { data } = await supabase
        .from("records")
        .select("content")
        .eq("person_id", personId)
        .eq("record_type", "EDU-001")
        .eq("is_draft", false)
        .order("record_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const goals =
        (data?.content as { annual_goals?: { area?: string; goal?: string }[] } | null)
          ?.annual_goals ?? [];
      const labels = goals
        .filter((g) => g.area && g.goal)
        .map((g) => `${g.area} · ${g.goal}`);
      setGoalOptions(labels);
      await checkRestore(applyDraft);
    })();
  }, [personId, checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft({ observedAt, situation, tags, note, linkedGoalArea });
  }, [observedAt, situation, tags, note, linkedGoalArea, saveDraft]);

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = () =>
    run(async () => {
      const input = {
        observedAt: observedAt.trim(),
        situation: situation.trim(),
        tags,
        note: note.trim(),
        linkedGoalArea: linkedGoalArea.trim() ? linkedGoalArea.trim() : undefined,
      };
      const parsed = observationSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await createObservation({ ...parsed.data, personId });
      if (res.error) return res.error;
      clearDraft();
      navigation.goBack();
    });

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>관찰기록 작성</Text>
      <Text style={styles.sub}>
        {personName || "학생"} · 행동·언어·사회성·학습 태그를 복수 선택할 수 있습니다.
      </Text>
      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.label}>관찰 일시</Text>
      <TextInput
        accessibilityLabel="관찰 일시. 예시 2026-07-08T10:30"
        value={observedAt}
        onChangeText={(v) => setObservedAt(formatDateTimeInput(v))}
        placeholder="YYYY-MM-DDTHH:MM"
        placeholderTextColor={NEUTRAL.textMuted}
        keyboardType="number-pad"
        maxLength={16}
        style={styles.input}
      />

      <Text style={styles.label}>관찰 상황</Text>
      <TextInput
        accessibilityLabel="관찰 상황"
        value={situation}
        onChangeText={setSituation}
        placeholder="예: 3교시 국어 모둠 활동"
        placeholderTextColor={NEUTRAL.textMuted}
        style={styles.input}
      />

      <View style={styles.tagHead}>
        <Text style={styles.label}>관찰 태그</Text>
        <Text style={styles.tagCount}>{tags.length}개 선택됨</Text>
      </View>
      {TAG_CATEGORIES.map(([category, catTags]) => (
        <View key={category} style={styles.tagCat}>
          <Text style={styles.tagCatLabel}>{category}</Text>
          <View style={styles.pickWrap}>
            {catTags.map((t) => (
              <CategoryChip
                key={t}
                emoji="🏷️"
                label={t}
                selected={tags.includes(t)}
                onPress={() => toggleTag(t)}
              />
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.label}>관찰 내용</Text>
      <TextInput
        accessibilityLabel="관찰 내용"
        value={note}
        onChangeText={setNote}
        placeholder="관찰한 행동·상황을 구체적으로 기술하세요"
        placeholderTextColor={NEUTRAL.textMuted}
        multiline
        style={styles.textarea}
      />

      {goalOptions.length > 0 ? (
        <>
          <Text style={styles.label}>연결할 IEP 목표 (선택)</Text>
          <View style={styles.pickWrap}>
            {goalOptions.map((label) => (
              <CategoryChip
                key={label}
                emoji="🔗"
                label={label}
                selected={linkedGoalArea === label}
                onPress={() => setLinkedGoalArea(linkedGoalArea === label ? "" : label)}
              />
            ))}
          </View>
        </>
      ) : null}

      <WizardFooter onPrev={() => navigation.goBack()} onSubmit={submit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2, marginBottom: SPACING.md },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: NEUTRAL.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
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
  tagHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tagCount: { fontSize: 13, fontWeight: "700", color: PRIMARY[700], marginTop: SPACING.md },
  tagCat: { marginTop: SPACING.sm },
  tagCatLabel: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textMuted, marginBottom: SPACING.xs },
  pickWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
