import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getUnreadNotificationCount } from "../lib/notifications";
import { NEUTRAL } from "../theme/colors";

/**
 * Wave M-1(docs/11-livinglab-mega-workshop.md) — 각 역할 Home 화면 상단에 놓는 알림 진입점.
 * 스택마다 자체 navigation 타입이 달라 이 컴포넌트는 navigation을 직접 다루지 않고
 * onPress만 호출부(각 HomeScreen)에서 주입받는다.
 */
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void getUnreadNotificationCount().then(setCount);
    }, [])
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `알림 ${count}건` : "알림"}
      onPress={onPress}
      hitSlop={8}
      style={styles.wrap}
    >
      <Text style={styles.icon}>🔔</Text>
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", padding: 4 },
  icon: { fontSize: 22 },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: NEUTRAL.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
});
