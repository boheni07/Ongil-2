import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";

export const ONBOARDING_SEEN_KEY = "@ongil/onboarding_seen";

const SLIDES = [
  {
    icon: "🗂️",
    title: "생애 전체를,\n함께 기록합니다",
    desc: "의료·교육·복지·일상·전환·법률 6개 도메인의 기록을 한곳에서 관리하세요.",
  },
  {
    icon: "🔐",
    title: "안전하게,\n필요한 만큼만",
    desc: "도메인·수준·기간별 권한을 직접 설정하고, 열람 로그까지 투명하게 확인하세요.",
  },
  {
    icon: "🤝",
    title: "함께 걷는\n사람들과 연결",
    desc: "보호자·활동지원사·특수교사·사회복지사·치료사가 한 사람의 생애를 함께 기록합니다.",
  },
] as const;

/** app-common.html ONBOARD — 최초 실행 시에만 노출되는 3슬라이드 온보딩. */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const finish = () => {
    void AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1");
    onDone();
  };

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="건너뛰기"
        onPress={finish}
        style={styles.skip}
        hitSlop={8}
      >
        <Text style={styles.skipText}>건너뛰기</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.visual}>
          <Text style={styles.visualIcon}>{slide.icon}</Text>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      <View style={styles.foot}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? "시작하기" : "다음"}
          onPress={() => (isLast ? finish() : setIndex((i) => i + 1))}
          style={({ pressed }) => [styles.next, pressed && styles.nextPressed]}
        >
          <Text style={styles.nextText}>{isLast ? "시작하기" : "다음"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEUTRAL.bg },
  skip: {
    position: "absolute",
    top: SPACING.xl,
    right: SPACING.lg,
    zIndex: 1,
    padding: SPACING.sm,
  },
  skipText: { color: NEUTRAL.textMuted, fontSize: FONT.body, fontWeight: "600" },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    backgroundColor: PRIMARY[50],
  },
  visual: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.xl + 12,
    backgroundColor: NEUTRAL.bg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
  },
  visualIcon: { fontSize: 56 },
  title: {
    fontSize: FONT.h2,
    fontWeight: "800",
    color: NEUTRAL.text,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  desc: {
    fontSize: FONT.body + 1,
    color: NEUTRAL.textMuted,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22,
  },
  foot: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, paddingTop: SPACING.lg },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NEUTRAL.border },
  dotOn: { width: 22, backgroundColor: PRIMARY[600] },
  next: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  nextPressed: { opacity: 0.85 },
  nextText: { color: "#fff", fontSize: FONT.h3, fontWeight: "700" },
});
