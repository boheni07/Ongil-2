import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DomainKey } from "@ongil/validation";
import {
  createGuardianRecord,
  getRecordDetail,
  updateGuardianRecord,
  type RecordDetail,
} from "../lib/records";
import { DomainChip } from "../components/DomainChip";
import { RecordContentView } from "../components/records/RecordContentView";
import { ErrorBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "RecordForm">;

const DOMAINS: { key: DomainKey; label: string }[] = [
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

/**
 * G-21 기록 작성·수정(모바일). recordId 유무로 신규/수정 분기.
 * 구조화 기록 수정 시 원본은 읽기 전용으로 보여주고 "보호자 메모"만 편집한다(웹과 동일 규칙).
 */
export function RecordFormScreen({ route, navigation }: Props) {
  const { personId, personName, recordId } = route.params;
  const insets = useSafeAreaInsets();
  const isEdit = Boolean(recordId);

  const [loading, setLoading] = useState(isEdit);
  const [existing, setExisting] = useState<RecordDetail | null>(null);
  const [domain, setDomain] = useState<DomainKey>("WEL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    let active = true;
    getRecordDetail(recordId).then((res) => {
      if (!active || !res) return;
      setExisting(res);
      setDomain(res.domain);
      if (res.isGuardianRecord) {
        setTitle(res.title);
        setBody((res.content as { body?: string } | null)?.body ?? "");
      } else {
        setTitle(res.guardianNote?.title ?? "");
        setBody(res.guardianNote?.body ?? "");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [recordId]);

  const isStructuredEdit = isEdit && existing ? !existing.isGuardianRecord : false;
  const valid = title.trim().length > 0 && body.trim().length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);

    const input = { domain, title: title.trim(), body: body.trim() };
    const res =
      isEdit && recordId
        ? await updateGuardianRecord(recordId, input)
        : await createGuardianRecord(personId, input);

    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    navigation.navigate("RecordManager", { personId, personName });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <Text style={styles.title}>{isEdit ? "기록 수정" : "새 기록 작성"}</Text>
      <Text style={styles.subtle}>{personName}</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          🔑 보호자는 guardians 관계로 도메인 제한 없이 모든 기록을 직접 작성·수정할 수
          있습니다(권한 매트릭스의 read/write/edit 부여와 무관).
        </Text>
      </View>

      {isStructuredEdit && existing && (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>
            원본 기록 내용(읽기 전용 · {existing.authorName ?? "전문가"} 작성)
          </Text>
          <View style={{ marginTop: SPACING.xs }}>
            <RecordContentView
              content={(() => {
                const rest = { ...((existing.content as Record<string, unknown>) ?? {}) };
                delete rest.guardianNote;
                return rest;
              })()}
            />
          </View>
        </View>
      )}

      {!isStructuredEdit && (
        <View style={{ marginTop: SPACING.lg }}>
          <Text style={styles.label}>도메인 선택</Text>
          <View accessibilityRole="radiogroup" style={styles.domainGrid}>
            {DOMAINS.map((d) => (
              <Pressable
                key={d.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: domain === d.key, disabled: isEdit }}
                disabled={isEdit}
                onPress={() => setDomain(d.key)}
                style={({ pressed }) => [
                  styles.domainOpt,
                  domain === d.key && styles.domainOptSel,
                  pressed && styles.pressed,
                ]}
              >
                <DomainChip domain={d.key} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ marginTop: SPACING.lg }}>
        <Text style={styles.label}>{isStructuredEdit ? "보호자 메모 제목" : "제목"}</Text>
        <TextInput
          accessibilityLabel="제목"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          style={styles.input}
        />
      </View>

      <View style={{ marginTop: SPACING.md }}>
        <Text style={styles.label}>{isStructuredEdit ? "보호자 메모 내용" : "내용"}</Text>
        <TextInput
          accessibilityLabel="내용"
          value={body}
          onChangeText={setBody}
          maxLength={5000}
          multiline
          placeholder="기록 내용을 입력하세요"
          placeholderTextColor={NEUTRAL.textMuted}
          style={[styles.input, styles.textarea]}
        />
      </View>

      <View style={{ marginTop: SPACING.md }}>
        <Text style={styles.label}>첨부파일</Text>
        <View style={[styles.attachBtn]}>
          <Text style={styles.attachBtnText}>📎 파일 첨부 (준비 중)</Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="저장"
        disabled={!valid || busy}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.submitBtn,
          (!valid || busy) && styles.submitDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.submitText}>{busy ? "저장 중..." : "저장"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 2 },
  notice: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: PRIMARY[50] },
  noticeText: { fontSize: FONT.body, color: PRIMARY[700] },
  block: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: NEUTRAL.border },
  blockLabel: { fontSize: FONT.label, fontWeight: "700", color: NEUTRAL.textMuted },
  blockBody: { marginTop: 4, fontSize: FONT.body, color: NEUTRAL.text },
  label: { fontSize: FONT.label, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.xs },
  domainGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  domainOpt: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  domainOptSel: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  pressed: { opacity: 0.85 },
  input: {
    minHeight: TOUCH_MIN,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.body,
    color: NEUTRAL.text,
    backgroundColor: "#fff",
  },
  textarea: { minHeight: 120, paddingTop: SPACING.sm, textAlignVertical: "top" },
  attachBtn: {
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
  },
  attachBtnText: { fontSize: 14, fontWeight: "700", color: NEUTRAL.textMuted },
  submitBtn: {
    marginTop: SPACING.xl,
    minHeight: TOUCH_MIN + 4,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { backgroundColor: PRIMARY[400] },
  submitText: { fontSize: 16, fontWeight: "800", color: "#fff" },
});
