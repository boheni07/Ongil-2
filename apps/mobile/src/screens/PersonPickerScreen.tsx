import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";

interface PickerItem {
  id: string;
  fullName: string;
}

/**
 * 하단 탭바 2차 탭(IEP/관찰/ISP/전환/치료계획/회기일지/평가 등)의 공용 진입 화면.
 * 대상자를 먼저 골라야 하는 위자드·타임라인류로 바로 진입할 수 없어, 대상자 목록을 보여주고
 * 탭하면 실제 목적 화면(targetRoute)으로 { personId, personName } 파라미터와 함께 이동한다.
 * 역할마다 달랐던 "학생 목록 → 위자드" 패턴(각 Home 화면에 이미 있던 것)을 탭 전용으로 재사용한다.
 */
export function PersonPickerScreen({
  title,
  emptyText,
  fetchItems,
  targetRoute,
  domainAccent = PRIMARY[600],
}: {
  title: string;
  emptyText: string;
  fetchItems: () => Promise<PickerItem[]>;
  targetRoute: string;
  domainAccent?: string;
}) {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PickerItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      void fetchItems().then((data) => {
        if (alive) {
          setItems(data);
          setLoading(false);
        }
      });
      return () => {
        alive = false;
      };
    }, [fetchItems])
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>대상자를 선택하세요</Text>
      {loading ? (
        <ActivityIndicator color={domainAccent} style={{ marginTop: SPACING.xl }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ gap: SPACING.sm, paddingTop: SPACING.md }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.fullName}
              onPress={() =>
                (navigation as { navigate: (route: string, params: unknown) => void }).navigate(
                  targetRoute,
                  { personId: item.id, personName: item.fullName }
                )
              }
              style={({ pressed }) => [
                styles.row,
                { borderLeftColor: domainAccent },
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowText}>{item.fullName}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEUTRAL.bg, padding: SPACING.xl },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  sub: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 4 },
  empty: {
    marginTop: SPACING.xl,
    fontSize: FONT.body,
    color: NEUTRAL.textMuted,
    textAlign: "center",
  },
  row: {
    minHeight: TOUCH_MIN + 8,
    backgroundColor: NEUTRAL.surface,
    borderRadius: RADIUS.md,
    borderLeftWidth: 4,
    paddingHorizontal: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowPressed: { opacity: 0.7 },
  rowText: { fontSize: FONT.body + 1, fontWeight: "700", color: NEUTRAL.text },
  chevron: { fontSize: 20, color: NEUTRAL.textMuted },
});
