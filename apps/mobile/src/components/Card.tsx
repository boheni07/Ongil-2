import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { RADIUS, SPACING } from "../theme/colors";

/**
 * 공용 카드 컨테이너(2026-07-20) — 웹의 rounded-xl·shadow-sm·ring 카드 스타일을 모바일
 * 작성 화면에도 일관되게 적용하기 위해 신설. 기존엔 각 화면이 흰 배경 하나로 모든 섹션을
 * 이어붙였는데(카드 구분 없음), 여러 작성 화면에 반복 적용하며 매번 스타일을 새로 정의하지
 * 않도록 공용 컴포넌트로 뺐다.
 */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
});
