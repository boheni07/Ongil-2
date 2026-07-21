import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  acknowledgeHandover,
  getReceivedHandovers,
  getSentHandovers,
  type HandoverSummary,
} from "../lib/handover";
import { relativeDay } from "../lib/date";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ErrorBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";
import type { SupporterStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<SupporterStackParamList, "HandoverList">;

type Tab = "received" | "sent";

const PRIORITY_LABEL: Record<string, string> = {
  high: "중요",
  normal: "보통",
  low: "참고",
};

/** S-20 인계인수 목록 — 받은/보낸 탭, 확인 CTA. docs/04-workflow.md Flow-S-02. */
export function HandoverListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("received");
  const [loading, setLoading] = useState(true);
  const [received, setReceived] = useState<HandoverSummary[]>([]);
  const [sent, setSent] = useState<HandoverSummary[]>([]);
  const { loading: acking, error, run } = useAsyncAction();

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([getReceivedHandovers(), getSentHandovers()]);
    setReceived(r);
    setSent(s);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const acknowledge = (id: string) =>
    run(async () => {
      const res = await acknowledgeHandover(id);
      if (res.error) return res.error;
      await load();
    });

  const items = tab === "received" ? received : sent;
  const pendingCount = received.filter((h) => !h.acknowledgedAt).length;

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="인계인수 작성"
        onPress={() => navigation.navigate("HandoverCompose")}
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
      >
        <Text style={styles.ctaText}>＋ 인계인수 작성</Text>
      </Pressable>

      <View style={styles.tabs}>
        <TabButton
          label="받은 인계"
          badge={pendingCount}
          active={tab === "received"}
          onPress={() => setTab("received")}
        />
        <TabButton label="보낸 인계" active={tab === "sent"} onPress={() => setTab("sent")} />
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {items.length === 0 ? (
        <Text style={styles.empty}>
          {tab === "received" ? "받은 인계인수가 없습니다." : "보낸 인계인수가 없습니다."}
        </Text>
      ) : (
        items.map((h) => (
          <HandoverCard
            key={h.id}
            item={h}
            tab={tab}
            acking={acking}
            onAcknowledge={() => acknowledge(h.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

function TabButton({
  label,
  badge,
  active,
  onPress,
}: {
  label: string;
  badge?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badge ? (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function HandoverCard({
  item,
  tab,
  acking,
  onAcknowledge,
}: {
  item: HandoverSummary;
  tab: Tab;
  acking: boolean;
  onAcknowledge: () => void;
}) {
  const confirmed = Boolean(item.acknowledgedAt);
  const counterparty =
    tab === "received"
      ? `${item.fromUserName ?? "담당자"} → 나`
      : `나 → ${item.toUserName ?? "담당자"}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardPerson}>{item.personName ?? "당사자"}</Text>
        <View style={styles.cardTags}>
          <View style={item.priority === "high" ? styles.priorityBadge : styles.priorityBadgeMuted}>
            <Text style={item.priority === "high" ? styles.priorityText : styles.priorityTextMuted}>
              {PRIORITY_LABEL[item.priority] ?? PRIORITY_LABEL.normal}
            </Text>
          </View>
          {confirmed ? (
            <View style={styles.confirmBadge}>
              <Text style={styles.confirmText}>✓ 확인됨</Text>
            </View>
          ) : (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>확인 대기</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.cardMeta}>
        {counterparty} · {relativeDay(item.createdAt)}
      </Text>
      <Text style={styles.cardContent}>{item.content}</Text>

      {tab === "received" && !confirmed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="확인했습니다"
          onPress={onAcknowledge}
          disabled={acking}
          style={({ pressed }) => [styles.ackBtn, pressed && styles.pressed]}
        >
          <Text style={styles.ackBtnText}>확인했습니다</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  cta: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  ctaText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  pressed: { opacity: 0.85 },
  tabs: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surface,
  },
  tabActive: { backgroundColor: PRIMARY[50], borderColor: PRIMARY[400] },
  tabText: { fontSize: 15, fontWeight: "600", color: NEUTRAL.textMuted },
  tabTextActive: { color: PRIMARY[700], fontWeight: "700" },
  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: NEUTRAL.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  empty: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: SPACING.md },
  card: {
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardPerson: { fontSize: 16, fontWeight: "700", color: NEUTRAL.text, flex: 1 },
  cardTags: { flexDirection: "row", alignItems: "center", gap: 6 },
  priorityBadge: {
    backgroundColor: NEUTRAL.dangerBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityText: { fontSize: 12, fontWeight: "700", color: NEUTRAL.danger },
  priorityBadgeMuted: {
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityTextMuted: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textMuted },
  confirmBadge: {
    backgroundColor: PRIMARY[50],
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confirmText: { fontSize: 12, fontWeight: "700", color: PRIMARY[700] },
  pendingBadge: {
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingText: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textMuted },
  cardMeta: { fontSize: 13, color: NEUTRAL.textMuted, marginTop: 6 },
  cardContent: { fontSize: 15, color: NEUTRAL.text, marginTop: SPACING.sm, lineHeight: 21 },
  ackBtn: {
    marginTop: SPACING.md,
    minHeight: TOUCH_MIN,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[50],
    borderWidth: 1,
    borderColor: PRIMARY[400],
  },
  ackBtnText: { fontSize: 15, fontWeight: "700", color: PRIMARY[700] },
});
