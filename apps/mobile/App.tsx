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
 * 세션 유무로 Auth Stack(미로그인)과 MainNavigator(로그인, role별 분기)를 나눈다.
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
