import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_TYPE_LABEL,
  type NotificationItem,
} from "../lib/notifications";
import { relativeDay } from "../lib/date";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ErrorBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";

/**
 * Wave M-1(docs/11-livinglab-mega-workshop.md) — 알림함(모바일). 웹 /notifications와
 * 동일 기능(목록·읽음 처리·모두 읽음). 각 역할 스택에 "Notifications" 라우트로 등록되며
 * route params가 없어 이 화면은 navigation/route를 쓰지 않는다(props 없음).
 */
export function NotificationListScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const { loading: busy, error, run } = useAsyncAction();

  const load = useCallback(async () => {
    setItems(await getNotifications());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const unreadCount = items.filter((n) => !n.isRead).length;

  const handleRead = (id: string) =>
    run(async () => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      const res = await markNotificationRead(id);
      if (res.error) return res.error;
    });

  const handleReadAll = () =>
    run(async () => {
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      const res = await markAllNotificationsRead();
      if (res.error) return res.error;
    });

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
      <View style={styles.headRow}>
        <Text style={styles.subtitle}>
          {unreadCount > 0 ? `안 읽은 알림 ${unreadCount}건` : "모두 읽었습니다."}
        </Text>
        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="모두 읽음 처리"
            disabled={busy}
            onPress={handleReadAll}
            style={({ pressed }) => [styles.readAllBtn, pressed && styles.pressed]}
          >
            <Text style={styles.readAllText}>모두 읽음 처리</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {items.length === 0 ? (
        <Text style={styles.empty}>알림이 없습니다.</Text>
      ) : (
        items.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={n.title}
            disabled={n.isRead || busy}
            onPress={() => handleRead(n.id)}
            style={({ pressed }) => [
              styles.card,
              n.isRead ? styles.cardRead : styles.cardUnread,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardTop}>
              {!n.isRead ? <View style={styles.dot} /> : null}
              <Text style={styles.type}>{NOTIFICATION_TYPE_LABEL[n.type] ?? n.type}</Text>
              <Text style={styles.date}>{relativeDay(n.sentAt)}</Text>
            </View>
            <Text style={styles.title}>{n.title}</Text>
            {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  subtitle: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  readAllBtn: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  readAllText: { fontSize: 13, fontWeight: "700", color: NEUTRAL.text },
  pressed: { opacity: 0.85 },
  empty: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: SPACING.md },
  card: {
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardRead: { backgroundColor: NEUTRAL.bg },
  cardUnread: { backgroundColor: PRIMARY[50] },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NEUTRAL.danger },
  type: { fontSize: 12, fontWeight: "700", color: PRIMARY[700] },
  date: { marginLeft: "auto", fontSize: 12, color: NEUTRAL.textMuted },
  title: { marginTop: 6, fontSize: 15, fontWeight: "700", color: NEUTRAL.text },
  body: { marginTop: 4, fontSize: 14, color: NEUTRAL.textMuted },
});
