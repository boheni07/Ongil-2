import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { loginSchema } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { ErrorBanner, Field, LinkText, PrimaryButton, ScreenTitle } from "../components/ui";
import { NEUTRAL, PRIMARY, SPACING } from "../theme/colors";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

/** A-02 로그인 — 이메일/비밀번호. 성공 시 세션이 생성되면 App이 메인으로 전환한다. */
export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loading, error, run } = useAsyncAction();

  const onSubmit = () =>
    run(async () => {
      const parsed = loginSchema.safeParse({ email: email.trim(), password });
      if (!parsed.success) return "이메일과 비밀번호를 올바르게 입력해주세요.";

      const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
      if (signInError) return "이메일 또는 비밀번호가 올바르지 않습니다.";
    });

  return (
    <ScreenScaffold>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>
          <Text style={{ color: PRIMARY[600] }}>온</Text>
          <Text style={{ color: NEUTRAL.text }}>길</Text>
        </Text>
      </View>
      <ScreenTitle title="환영합니다" desc="로그인하여 기록을 이어가세요" center />

      {error ? <ErrorBanner message={error} /> : null}

      <Field
        label="이메일"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        placeholder="비밀번호 입력"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />

      <View style={styles.linkRow}>
        <LinkText label="비밀번호 찾기" onPress={() => navigation.navigate("ResetPassword")} />
      </View>

      <PrimaryButton label="로그인" onPress={onSubmit} loading={loading} />

      <View style={styles.altRow}>
        <Text style={styles.altText}>아직 계정이 없으신가요? </Text>
        <LinkText label="회원가입" onPress={() => navigation.navigate("RoleSelect")} />
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginTop: SPACING.xl, marginBottom: SPACING.md },
  wordmark: { fontSize: 28, fontWeight: "800" },
  linkRow: { alignItems: "flex-end", marginBottom: SPACING.md },
  altRow: { flexDirection: "row", justifyContent: "center", marginTop: SPACING.lg },
  altText: { color: NEUTRAL.textMuted, fontSize: 14 },
});
