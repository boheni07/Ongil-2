import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { AuthNavigator } from "./src/navigation/AuthNavigator";
import { MainNavigator } from "./src/navigation/MainNavigator";
import { NEUTRAL, PRIMARY } from "./src/theme/colors";

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
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      void reactivateIfNeeded(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void reactivateIfNeeded(next);
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
      ) : (
        <NavigationContainer>
          {session ? <MainNavigator session={session} /> : <AuthNavigator />}
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: NEUTRAL.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
