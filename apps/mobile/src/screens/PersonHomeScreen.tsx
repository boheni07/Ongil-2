import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { personProfileSchema } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import {
  ensurePersonProfile,
  getMyPersonProfile,
  getRecentSelfExpressions,
  type SelfExpressionDay,
} from "../lib/person";
import { getUnreadNotificationCount } from "../lib/notifications";
import { computeLifeStage } from "../lib/iep";
import { MOOD_CHOICES } from "../lib/content";
import { formatKoreanDate, formatShortDate } from "../lib/date";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ErrorBanner } from "../components/ui";
import { StageBadge } from "../components/lifecycle/StageBadge";
import { ACCENT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { PersonStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<PersonStackParamList, "PersonHome">;

const GENDERS = [
  { value: "M", label: "남성" },
  { value: "F", label: "여성" },
  { value: "other", label: "기타" },
] as const;

/** P-01 오늘 기록 홈 — persons 없으면 프로필 만들기, 있으면 큰 CTA + 최근 7일 요약. */
export function PersonHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ fullName: string; birthDate: string } | null>(null);
  const [recent, setRecent] = useState<SelfExpressionDay[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    const p = await getMyPersonProfile();
    setProfile(p);
    if (p) setRecent(await getRecentSelfExpressions());
    setUnreadCount(await getUnreadNotificationCount());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      {profile ? (
        <HomeBody
          navigation={navigation}
          name={profile.fullName}
          birthDate={profile.birthDate}
          recent={recent}
          unreadCount={unreadCount}
        />
      ) : (
        <ProfileForm onDone={load} />
      )}
    </ScrollView>
  );
}

function HomeBody({
  navigation,
  name,
  birthDate,
  recent,
  unreadCount,
}: {
  navigation: Props["navigation"];
  name: string;
  birthDate: string;
  recent: SelfExpressionDay[];
  unreadCount: number;
}) {
  const moodEmoji = (m: SelfExpressionDay["mood"]) =>
    m ? (MOOD_CHOICES.find((c) => c.value === m)?.emoji ?? "•") : "·";

  return (
    <View>
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.date}>{formatKoreanDate()}</Text>
          {birthDate ? <StageBadge lifeStage={computeLifeStage(birthDate)} simple /> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          onPress={() => supabase.auth.signOut()}
          hitSlop={8}
        >
          <Text style={styles.logout}>로그아웃</Text>
        </Pressable>
      </View>
      <Text style={styles.greet}>안녕하세요, {name}님!{"\n"}오늘 하루는 어땠어요?</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="오늘 이야기하기. 기분, 밥, 활동을 눌러서 알려주세요."
        onPress={() => navigation.navigate("SelfExpression")}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <Text style={styles.ctaEmoji}>✏️</Text>
        <Text style={styles.ctaTitle}>오늘 이야기하기</Text>
        <Text style={styles.ctaSub}>기분·밥·활동을 눌러서 알려주세요</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="내 기록 보기. 나에 대한 기록을 볼 수 있어요."
        onPress={() => navigation.navigate("MyRecords")}
        style={({ pressed }) => [styles.secondaryCta, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryCtaText}>📁 내 기록 보기</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="개인정보와 동의 관리. 내 동의 현황을 보고 권리를 행사할 수 있어요."
        onPress={() => navigation.navigate("PrivacySettings")}
        style={({ pressed }) => [styles.secondaryCta, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryCtaText}>⚙️ 개인정보·동의 관리</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unreadCount > 0 ? `알림. 안 읽은 알림 ${unreadCount}건` : "알림"}
        onPress={() => navigation.navigate("Notifications")}
        style={({ pressed }) => [styles.secondaryCta, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryCtaText}>
          🔔 알림{unreadCount > 0 ? ` (${unreadCount})` : ""}
        </Text>
      </Pressable>

      <Text style={styles.sectionTitle}>최근 7일</Text>
      {recent.length === 0 ? (
        <Text style={styles.emptyText}>아직 남긴 이야기가 없어요. 첫 이야기를 들려주세요!</Text>
      ) : (
        <View style={styles.weekRow}>
          {recent.slice(0, 7).map((d, i) => (
            <View key={`${d.recordDate}-${i}`} style={styles.dayCell}>
              <Text style={styles.dayEmoji}>{moodEmoji(d.mood)}</Text>
              <Text style={styles.dayLabel}>{formatShortDate(d.recordDate)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ProfileForm({ onDone }: { onDone: () => Promise<void> }) {
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "other" | null>(null);
  const { loading, error, run } = useAsyncAction();

  const submit = () =>
    run(async () => {
      const parsed = personProfileSchema.safeParse({
        fullName: fullName.trim(),
        birthDate: birthDate.trim(),
        gender: gender ?? undefined,
      });
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await ensurePersonProfile(parsed.data);
      if (res.error) return res.error;
      await onDone();
    });

  return (
    <View>
      <Text style={styles.formTitle}>내 프로필 만들기</Text>
      <Text style={styles.formDesc}>기록을 시작하려면 먼저 나를 알려주세요.</Text>

      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.bigLabel}>이름</Text>
      <TextInput
        accessibilityLabel="이름"
        value={fullName}
        onChangeText={setFullName}
        placeholder="이름을 입력하세요"
        placeholderTextColor={NEUTRAL.textMuted}
        style={styles.bigInput}
      />

      <Text style={styles.bigLabel}>생년월일</Text>
      <TextInput
        accessibilityLabel="생년월일. 예시 2000-01-31"
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={NEUTRAL.textMuted}
        keyboardType="numbers-and-punctuation"
        style={styles.bigInput}
      />

      <Text style={styles.bigLabel}>성별 (선택)</Text>
      <View style={styles.genderRow}>
        {GENDERS.map((g) => {
          const sel = gender === g.value;
          return (
            <Pressable
              key={g.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={g.label}
              onPress={() => setGender(sel ? null : g.value)}
              style={({ pressed }) => [
                styles.genderChip,
                sel && styles.genderChipSel,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.genderText, sel && styles.genderTextSel]}>{g.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="프로필 만들기"
        accessibilityState={{ disabled: loading }}
        onPress={submit}
        disabled={loading}
        style={({ pressed }) => [
          styles.submit,
          loading && styles.submitDisabled,
          pressed && !loading && styles.pressed,
        ]}
      >
        <Text style={styles.submitText}>{loading ? "만드는 중…" : "프로필 만들기"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { gap: SPACING.sm, alignItems: "flex-start" },
  date: { fontSize: 18, fontWeight: "600", color: NEUTRAL.textMuted },
  logout: { fontSize: 16, fontWeight: "600", color: PRIMARY[600] },
  greet: { fontSize: 28, fontWeight: "800", color: NEUTRAL.text, lineHeight: 38, marginTop: SPACING.sm },
  cta: {
    marginTop: SPACING.xl,
    borderRadius: RADIUS.xl,
    // 웹 P-01 히어로 CTA(bg-accent-amber, 프로토타입 원문)와 동일하게 맞춘다 —
    // 이전엔 모바일만 primary-900이라 플랫폼 간 색상이 어긋나 있었다(2026-07-19).
    backgroundColor: ACCENT.amber,
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  ctaEmoji: { fontSize: 56 },
  ctaTitle: { fontSize: 26, fontWeight: "800", color: ACCENT.stone },
  ctaSub: { fontSize: 18, color: ACCENT.stone, opacity: 0.8, textAlign: "center" },
  secondaryCta: {
    marginTop: SPACING.md,
    minHeight: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: PRIMARY[400],
    backgroundColor: PRIMARY[50],
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCtaText: { fontSize: 20, fontWeight: "800", color: PRIMARY[800] },
  pressed: { opacity: 0.85 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: NEUTRAL.text, marginTop: SPACING.xl },
  emptyText: { fontSize: 18, color: NEUTRAL.textMuted, marginTop: SPACING.md, lineHeight: 26 },
  weekRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.md },
  dayCell: {
    alignItems: "center",
    gap: 4,
    minWidth: 64,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.surface,
  },
  dayEmoji: { fontSize: 32 },
  dayLabel: { fontSize: 13, color: NEUTRAL.textMuted },
  formTitle: { fontSize: 26, fontWeight: "800", color: NEUTRAL.text },
  formDesc: { fontSize: 18, color: NEUTRAL.textMuted, marginTop: SPACING.sm, marginBottom: SPACING.xl, lineHeight: 26 },
  bigLabel: { fontSize: 20, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
  bigInput: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 20,
    color: NEUTRAL.text,
    backgroundColor: NEUTRAL.bg,
  },
  genderRow: { flexDirection: "row", gap: SPACING.sm },
  genderChip: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
  },
  genderChipSel: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  genderText: { fontSize: 18, fontWeight: "700", color: NEUTRAL.text },
  genderTextSel: { color: PRIMARY[800] },
  submit: {
    marginTop: SPACING.xl,
    minHeight: 60,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { backgroundColor: PRIMARY[400] },
  submitText: { fontSize: 22, fontWeight: "800", color: "#fff" },
});
