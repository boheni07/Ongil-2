import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { PRIMARY } from "../theme/colors";

/** app-common.html SPLASH — 세션 확인 중(App.tsx `!ready`) 노출되는 브랜드 스플래시. */
export function SplashScreen() {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.inner, { transform: [{ scale }], opacity }]}>
        <Text style={styles.wordmark}>
          <Text style={{ color: PRIMARY[400] }}>온</Text>
          <Text style={{ color: "#fff" }}>길</Text>
        </Text>
        <Text style={styles.slogan}>내 삶의 모든 길이 여기 있습니다</Text>
      </Animated.View>
      <Text style={styles.foot}>© 2026 Ongil</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PRIMARY[900],
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { alignItems: "center" },
  wordmark: { fontSize: 40, fontWeight: "800", letterSpacing: -0.5 },
  slogan: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: 14 },
  foot: {
    position: "absolute",
    bottom: 30,
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
});
