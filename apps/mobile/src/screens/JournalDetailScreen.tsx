import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getJournalDetail, type SupportJournalDetail } from "../lib/journal";
import {
  categoryEmoji,
  JOURNAL_HEALTH_CHOICES,
  JOURNAL_MEAL_CHOICES,
} from "../lib/content";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SupporterStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SupporterStackParamList, "JournalDetail">;

/** S-13 일지 상세 — 단일 활동일지 전체 내용. */
export function JournalDetailScreen({ route }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [journal, setJournal] = useState<SupportJournalDetail | null>(null);

  useEffect(() => {
    void (async () => {
      setJournal(await getJournalDetail(route.params.journalId));
      setLoading(false);
    })();
  }, [route.params.journalId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} />
      </View>
    );
  }

  if (!journal) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>일지를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const c = journal.content;
  const meal = JOURNAL_MEAL_CHOICES.find((m) => m.value === c.meal_status);
  const health = JOURNAL_HEALTH_CHOICES.find((h) => h.value === c.health_status);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <View style={styles.head}>
        <Text style={styles.title}>활동일지</Text>
        <View style={[styles.badge, journal.isDraft ? styles.badgeDraft : styles.badgeDone]}>
          <Text style={[styles.badgeText, journal.isDraft ? styles.badgeTextDraft : styles.badgeTextDone]}>
            {journal.isDraft ? "임시저장" : "제출 완료"}
          </Text>
        </View>
      </View>
      <Text style={styles.subtle}>
        {journal.personName ?? "이용자"} · {c.service_date}
      </Text>

      <Section title="서비스 정보">
        <KV k="이용자" v={journal.personName ?? "-"} />
        <KV k="날짜" v={c.service_date} />
        <KV
          k="시간"
          v={`${c.start_time} ~ ${c.end_time}${c.service_hours != null ? ` (${c.service_hours}시간)` : ""}`}
        />
      </Section>

      <Section title="활동 내역">
        {c.activities.length === 0 ? (
          <Text style={styles.muted}>기록된 활동이 없습니다.</Text>
        ) : (
          <View style={styles.tagWrap}>
            {c.activities.map((a, i) => (
              <View key={`${a.category}-${i}`} style={styles.tag}>
                <Text style={styles.tagText}>
                  {categoryEmoji(a.category)} {a.category} {a.minutes}분
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="건강·식사">
        <KV k="식사" v={meal ? `${meal.emoji} ${meal.label}` : "-"} />
        <KV k="건강" v={health ? `${health.emoji} ${health.label}` : "-"} />
      </Section>

      <Section title="특이사항">
        <Text style={styles.body}>{c.incidents?.trim() || "없음"}</Text>
      </Section>

      {c.handover_note?.trim() ? (
        <Section title="다음 지원사 인계">
          <Text style={styles.body}>{c.handover_note}</Text>
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: FONT.h1, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 4 },
  badge: { borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDone: { backgroundColor: PRIMARY[50] },
  badgeDraft: { backgroundColor: "#FFF5E6" },
  badgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextDone: { color: PRIMARY[700] },
  badgeTextDraft: { color: "#B56F10" },
  section: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
  },
  sectionTitle: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.sm },
  kv: { flexDirection: "row", paddingVertical: 5, gap: SPACING.md },
  k: { width: 72, fontSize: 14, color: NEUTRAL.textMuted },
  v: { flex: 1, fontSize: 14, fontWeight: "600", color: NEUTRAL.text },
  body: { fontSize: 14, lineHeight: 22, color: NEUTRAL.text },
  muted: { fontSize: 14, color: NEUTRAL.textMuted },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tag: {
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: { fontSize: 13, fontWeight: "600", color: NEUTRAL.text },
});
