import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { resetRequestSchema } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { ErrorBanner, Field, InfoBanner, LinkText, PrimaryButton, ScreenTitle } from "../components/ui";
import { SPACING } from "../theme/colors";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

/**
 * A-07 비밀번호 재설정 — 재설정 링크 발송 요청. 사용자 열거 방지를 위해 항상 동일한
 * 성공 메시지를 반환한다(웹 requestPasswordReset과 동일).
 * 링크 클릭 후 새 비밀번호 설정(recovery 세션)의 딥링크 처리는 이번 범위 밖(보고 참조).
 */
export function ResetPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { loading, error, run } = useAsyncAction();

  const onSubmit = () =>
    run(async () => {
      const parsed = resetRequestSchema.safeParse({ email: email.trim() });
      if (!parsed.success) return "올바른 이메일을 입력해주세요.";

      await supabase.auth.resetPasswordForEmail(parsed.data.email);
      setSent(true);
    });

  return (
    <ScreenScaffold>
      <ScreenTitle
        title="비밀번호 재설정"
        desc="가입 이메일로 재설정 링크를 보내드립니다"
        center
      />

      {error ? <ErrorBanner message={error} /> : null}
      {sent ? <InfoBanner message="등록된 이메일이면 재설정 링크가 발송됩니다." /> : null}

      <Field
        label="이메일"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        hint="등록된 이메일이면 링크가 발송됩니다."
      />

      <PrimaryButton label="재설정 링크 받기" onPress={onSubmit} loading={loading} />

      <View style={{ alignItems: "center", marginTop: SPACING.lg }}>
        <LinkText label="← 로그인으로 돌아가기" onPress={() => navigation.navigate("Login")} />
      </View>
    </ScreenScaffold>
  );
}
