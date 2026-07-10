import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { AuthNavigator } from "./src/navigation/AuthNavigator";
import { NEUTRAL, PRIMARY, SPACING } from "./src/theme/colors";

/**
 * 세션 유무로 Auth Stack(미로그인)과 메인(로그인)을 분기한다.
 * 이번 범위는 인증·온보딩(A-02~A-10)이므로 로그인 후 화면은 자리표시자다.
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY[600]} />
        </View>
      ) : session ? (
        <SignedInPlaceholder />
      ) : (
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

function SignedInPlaceholder() {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>로그인되었습니다</Text>
      <Text style={styles.sub}>역할별 홈 화면은 다음 범위에서 구현됩니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: NEUTRAL.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  title: { fontSize: 20, fontWeight: "700", color: NEUTRAL.text },
  sub: { fontSize: 14, color: NEUTRAL.textMuted, textAlign: "center" },
});
