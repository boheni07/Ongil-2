import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import {
  getSupporterJournals,
  submitSupportJournal,
  type SupportJournalSummary,
} from "../lib/journal";
import { getReceivedHandovers, type HandoverSummary } from "../lib/handover";
import { flushQueue, getQueue } from "../lib/offline-queue";
import { useNetworkSync } from "../hooks/useNetworkSync";
import { formatKoreanDate, relativeDay } from "../lib/date";
import { NotificationBell } from "../components/NotificationBell";
import { BacklogTaskCard, type BacklogTaskItem } from "../components/records/BacklogTaskCard";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { SupporterStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SupporterStackParamList, "SupporterHome">;

/**
 * S-01 홈 — 인사·통계, 활동일지 작성 CTA, 작성한 일지 목록.
 * "처리 대기 중"(docs/14 Wave W-4)은 방문 일정이 없어 날짜 기반 카드 대신 "임시저장 일지"
 * 백로그로 대체한다(웹 동형) — 기존 "임시저장" 통계를 목록형으로 승격한 것뿐이다.
 */
export function SupporterHomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [journals, setJournals] = useState<SupportJournalSummary[]>([]);
  const [handovers, setHandovers] = useState<HandoverSummary[]>([]);
  const [pendingSync, setPendingSync] = useState(0);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};
    setName((meta.full_name as string) || (meta.name as string) || "");
    setJournals(await getSupporterJournals());
    setHandovers(await getReceivedHandovers(5));
    setPendingSync((await getQueue("journal")).length);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // 온라인 전환/포그라운드 복귀 시 큐잉된 오프라인 일지를 자동 재제출 후 목록 갱신.
  useNetworkSync(
    useCallback(() => {
      void flushQueue("journal", submitSupportJournal).then((res) => {
        if (res.synced > 0) void load();
        else setPendingSync(res.remaining);
      });
    }, [load])
  );

  const draftJournals = journals.filter((j) => j.isDraft);
  const draftCount = draftJournals.length;
  const backlogItems: BacklogTaskItem[] = draftJournals.map((j) => ({
    personId: j.personId,
    personName: j.personName ?? "이용자",
    label: "일지 임시저장 — 마저 작성",
    onPress: () => navigation.navigate("JournalDetail", { journalId: j.id }),
  }));

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
      <View style={styles.topRow}>
        <Text style={styles.title}>안녕하세요{name ? `, ${name} 님` : ""} 👋</Text>
        <View style={styles.topRowActions}>
          <NotificationBell onPress={() => navigation.navigate("Notifications")} />
        </View>
      </View>
      <Text style={styles.subtle}>{formatKoreanDate()}</Text>

      <View style={styles.statsRow}>
        <Stat n={journals.length} label="작성한 일지" />
        <Stat n={draftCount} label="임시저장" />
        <Stat n={journals.length - draftCount} label="제출 완료" />
      </View>

      {pendingSync > 0 ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityLabel={`동기화 대기 중인 일지 ${pendingSync}건. 네트워크가 연결되면 자동으로 저장됩니다.`}
          style={styles.syncBanner}
        >
          <Text style={styles.syncBannerText}>
            📡 동기화 대기 중인 일지 {pendingSync}건 · 연결되면 자동 저장됩니다
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="활동일지 작성"
        onPress={() => navigation.navigate("JournalCompose")}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <Text style={styles.ctaText}>＋ 활동일지 작성</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="인계인수"
        onPress={() => navigation.navigate("HandoverList")}
        style={({ pressed }) => [styles.secondaryCta, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryCtaText}>🔁 인계인수</Text>
      </Pressable>

      <BacklogTaskCard
        title="📋 처리 대기 중"
        emptyText="임시저장된 일지가 없습니다."
        items={backlogItems}
      />

      <Text style={styles.sectionTitle}>작성한 일지</Text>
      {journals.length === 0 ? (
        <Text style={styles.empty}>아직 작성한 일지가 없습니다.</Text>
      ) : (
        journals.map((j) => (
          <Pressable
            key={j.id}
            accessibilityRole="button"
            accessibilityLabel={`${j.personName ?? "이용자"} ${j.serviceDate ?? ""} 일지 상세`}
            onPress={() => navigation.navigate("JournalDetail", { journalId: j.id })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{j.personName ?? "이용자"}</Text>
              <Text style={styles.rowMeta}>
                {j.serviceDate ?? relativeDay(j.recordDate)}
                {j.serviceHours != null ? ` · ${j.serviceHours}시간` : ""}
              </Text>
            </View>
            {j.isDraft ? (
              <View style={styles.draftBadge}>
                <Text style={styles.draftText}>임시저장</Text>
              </View>
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        ))
      )}

      {/* 프로토타입 web-supporter.html/app-supporter.html S-01 "🔁 최근 인계인수" — 웹엔 없던
          섹션이었으나(2026-07-19 신설), 모바일은 처음부터 함께 반영한다. */}
      <Text style={styles.sectionTitle}>🔁 최근 인계인수</Text>
      {handovers.length === 0 ? (
        <Text style={styles.empty}>받은 인계인수가 없습니다.</Text>
      ) : (
        handovers.map((h) => (
          <Pressable
            key={h.id}
            accessibilityRole="button"
            accessibilityLabel={`${h.fromUserName ?? "알 수 없음"} → ${h.personName ?? "당사자"} 님 관련 인계인수`}
            onPress={() => navigation.navigate("HandoverList")}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.handoverAv}>
              <Text style={styles.handoverAvText}>{(h.fromUserName ?? "?").slice(0, 1)}</Text>
            </View>
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>
                {h.fromUserName ?? "알 수 없음"} → {h.personName ?? "당사자"} 님 관련
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {h.content} · {relativeDay(h.createdAt)}
              </Text>
            </View>
            {h.priority === "high" ? (
              <View style={styles.draftBadge}>
                <Text style={styles.draftText}>중요</Text>
              </View>
            ) : !h.acknowledgedAt ? (
              <View style={styles.unreadDot} />
            ) : null}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topRowActions: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text, flex: 1 },
  logout: { fontSize: 14, fontWeight: "600", color: PRIMARY[600] },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.surface,
  },
  statN: { fontSize: 24, fontWeight: "800", color: PRIMARY[700] },
  statL: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: 2 },
  syncBanner: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: "#FFF5E6",
    borderWidth: 1,
    borderColor: "#F0C98A",
  },
  syncBannerText: { fontSize: 13, fontWeight: "600", color: "#B56F10" },
  cta: {
    marginTop: SPACING.xl,
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  secondaryCta: {
    marginTop: SPACING.md,
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[50],
    borderWidth: 1,
    borderColor: PRIMARY[400],
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCtaText: { fontSize: 16, fontWeight: "700", color: PRIMARY[700] },
  pressed: { opacity: 0.85 },
  sectionTitle: { fontSize: FONT.h3, fontWeight: "700", color: NEUTRAL.text, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  empty: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: SPACING.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  rowMain: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: "700", color: NEUTRAL.text },
  rowMeta: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 2 },
  draftBadge: {
    backgroundColor: "#FFF5E6",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  draftText: { fontSize: 12, fontWeight: "700", color: "#B56F10" },
  chevron: { fontSize: 24, color: NEUTRAL.textMuted },
  handoverAv: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  handoverAvText: { fontSize: 14, fontWeight: "800", color: PRIMARY[700] },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E04545" },
});
