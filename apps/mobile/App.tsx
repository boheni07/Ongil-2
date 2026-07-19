import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { AuthNavigator } from "./src/navigation/AuthNavigator";
import { MainNavigator } from "./src/navigation/MainNavigator";
import { SplashScreen } from "./src/screens/SplashScreen";
import { ONBOARDING_SEEN_KEY, OnboardingScreen } from "./src/screens/OnboardingScreen";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "./src/theme/colors";

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// DSN 미설정 또는 개발 환경(__DEV__)에서는 전송하지 않아 로컬 노이즈를 막는다.
// 릴리즈/dist는 Expo 플러그인이 앱 버전·빌드번호에서 자동 태깅한다.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
  environment: __DEV__ ? "development" : "production",
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
  integrations: [navigationIntegration],
});

const navigationRef = createNavigationContainerRef();

/**
 * 로그인 세션이 있는데 계정이 비활성화(deactivated_at) 상태면 로그인 자체를 "재활성화 의사"로
 * 보고 해제한다(설정 > 개인정보 화면의 "동의 전체철회 및 계정 비활성화" 대응 — 계정 삭제가
 * 아니므로 재로그인으로 되돌릴 수 있어야 한다).
 */
async function reactivateIfNeeded(session: Session | null) {
  if (!session) return;
  const { data } = await supabase
    .from("users")
    .select("deactivated_at")
    .eq("id", session.user.id)
    .maybeSingle();
  if (data?.deactivated_at) {
    await supabase.from("users").update({ deactivated_at: null }).eq("id", session.user.id);
  }
}

/**
 * 세션 유무로 Auth Stack(미로그인)과 MainNavigator(로그인, role별 분기)를 나눈다.
 * 최초 실행(미로그인 + 온보딩 미확인)에는 스플래시 후 온보딩을 먼저 보여준다
 * (app-common.html SPLASH/ONBOARD) — 재방문·로그인된 사용자는 지연 없이 바로 진입한다.
 */
function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    const start = Date.now();
    Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(ONBOARDING_SEEN_KEY)]).then(
      ([{ data }, seen]) => {
        setSession(data.session);
        setOnboardingSeen(seen === "1");
        void reactivateIfNeeded(data.session);
        // 프로토타입의 스플래시 노출 시간(2.2초)은 최초 실행(온보딩 진입 예정)에만 적용한다.
        const needsSplashDelay = !data.session && seen !== "1";
        const wait = needsSplashDelay ? Math.max(0, 2200 - (Date.now() - start)) : 0;
        setTimeout(() => setReady(true), wait);
      }
    );
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void reactivateIfNeeded(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const showOnboarding = ready && onboardingSeen === false && !session;

  return (
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <SafeAreaProvider>
        <StatusBar style={showOnboarding || !ready ? "light" : "dark"} />
        {!ready ? (
          <SplashScreen />
        ) : showOnboarding ? (
          <OnboardingScreen onDone={() => setOnboardingSeen(true)} />
        ) : (
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              navigationIntegration.registerNavigationContainer(navigationRef);
            }}
          >
            {session ? <MainNavigator session={session} /> : <AuthNavigator />}
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </Sentry.ErrorBoundary>
  );
}

function ErrorFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>잠시 문제가 생겼어요</Text>
      <Text style={styles.fallbackBody}>
        일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.
      </Text>
      <Pressable style={styles.fallbackButton} onPress={resetError}>
        <Text style={styles.fallbackButtonText}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: NEUTRAL.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  fallbackTitle: {
    fontSize: FONT.h3,
    fontWeight: "600",
    color: NEUTRAL.text,
    marginBottom: SPACING.sm,
  },
  fallbackBody: {
    fontSize: FONT.body,
    color: NEUTRAL.textMuted,
    textAlign: "center",
    marginBottom: SPACING.xl,
  },
  fallbackButton: {
    height: 44,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[700],
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackButtonText: {
    color: NEUTRAL.bg,
    fontSize: FONT.body,
    fontWeight: "500",
  },
});

export default Sentry.wrap(App);
