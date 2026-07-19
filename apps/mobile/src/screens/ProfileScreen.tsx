import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { profileSchema } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { StepBar } from "../components/StepBar";
import { ErrorBanner, Field, PrimaryButton, ScreenTitle } from "../components/ui";
import { formatPhoneNumber } from "../lib/format";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Profile">;

/**
 * A-04 기본 정보 — profileSchema 검증 후 supabase.auth.signUp()으로 계정 생성.
 * role은 직전 A-03에서 받아 user_metadata에 저장(웹 submitProfile과 동일 패턴).
 */
export function ProfileScreen({ navigation, route }: Props) {
  const { role, invite } = route.params;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const { loading, error, run } = useAsyncAction();

  const onNext = () =>
    run(async () => {
      const parsed = profileSchema.safeParse({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        passwordConfirm,
        phone: phone.trim(),
      });
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";

      const { error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { data: { role, full_name: parsed.data.fullName, phone: parsed.data.phone } },
      });
      if (signUpError) return signUpError.message;

      navigation.navigate("Consent", { role, email: parsed.data.email, invite });
    });

  return (
    <ScreenScaffold>
      <StepBar current={2} />
      <ScreenTitle title="기본 정보 입력" desc="안전한 계정 생성을 위한 정보입니다" />

      {error ? <ErrorBanner message={error} /> : null}

      <Field label="이름" value={fullName} onChangeText={setFullName} placeholder="실명 입력" />
      <Field
        label="이메일"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        hint="이 이메일로 인증 메일이 발송됩니다."
      />
      <Field
        label="비밀번호"
        value={password}
        onChangeText={setPassword}
        placeholder="8자 이상"
        secureTextEntry
      />
      <Field
        label="비밀번호 확인"
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        placeholder="다시 입력"
        secureTextEntry
      />
      <Field
        label="휴대폰 번호"
        value={phone}
        onChangeText={(v) => setPhone(formatPhoneNumber(v))}
        placeholder="010-0000-0000"
        keyboardType="number-pad"
        maxLength={13}
      />

      <PrimaryButton label="다음" onPress={onNext} loading={loading} />
    </ScreenScaffold>
  );
}
