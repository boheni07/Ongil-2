import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { otpVerifySchema } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { StepBar } from "../components/StepBar";
import { OtpInput, OTP_LENGTH } from "../components/OtpInput";
import { ErrorBanner, InfoBanner, LinkText, PrimaryButton, ScreenTitle } from "../components/ui";
import { NEUTRAL, SPACING } from "../theme/colors";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "VerifyEmail">;

const RESEND_SECONDS = 60;

/**
 * A-05 이메일 OTP 인증 — verifyOtp(type:'email'). 성공 시 세션이 생성되며,
 * invite가 있으면 accept_invitation RPC로 권한을 전개한다(실패해도 로그인은 유지).
 */
type ConsentType = "terms" | "privacy" | "sensitive" | "marketing";

export function VerifyEmailScreen({ route }: Props) {
  const { email, marketingAgreed, invite } = route.params;
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resendNonce, setResendNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const { loading, error, run } = useAsyncAction();

  useEffect(() => {
    setCountdown(RESEND_SECONDS);
    const id = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendNonce]);

  const onVerify = () =>
    run(async () => {
      const parsed = otpVerifySchema.safeParse({ email, token: code });
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "인증 코드는 6자리입니다.";

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: parsed.data.email,
        token: parsed.data.token,
        type: "email",
      });
      if (verifyError || !data.user) return "인증 코드가 올바르지 않거나 만료되었습니다.";
      const user = data.user;

      // A-08에서 미룬 PIPA 동의 INSERT — 세션이 이제 확보돼 auth.uid()가 채워진다.
      const now = new Date().toISOString();
      const types: ConsentType[] = ["terms", "privacy", "sensitive"];
      if (marketingAgreed) types.push("marketing");
      const rows = types.map((consent_type) => ({
        user_id: user.id,
        consent_type,
        is_agreed: true,
        version: "v1.0",
        agreed_at: now,
      }));
      const { error: consentError } = await supabase.from("consents").insert(rows);
      if (consentError) return consentError.message;

      if (invite) {
        // 초대 전개 실패는 온보딩을 막지 않는다(보호자가 재발송 가능).
        await supabase.rpc("accept_invitation", { p_token: invite });
      }
      // 세션 생성 완료 → App의 세션 리스너가 메인으로 전환한다.
    });

  const onResend = () =>
    run(async () => {
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
      if (resendError) return resendError.message;
      setNotice("인증 코드를 다시 보냈습니다.");
      setResendNonce((n) => n + 1);
    });

  return (
    <ScreenScaffold>
      <StepBar current={4} />
      <View style={styles.center}>
        <Text style={styles.icon}>✉️</Text>
      </View>
      <ScreenTitle
        title="이메일을 확인하세요"
        desc={`${email} 으로 보낸\n6자리 코드를 입력하세요`}
        center
      />

      {error ? <ErrorBanner message={error} /> : null}
      {notice ? <InfoBanner message={notice} /> : null}

      <OtpInput value={code} onChange={setCode} />

      <PrimaryButton
        label="인증 완료"
        onPress={onVerify}
        loading={loading}
        disabled={code.length < OTP_LENGTH}
      />

      <View style={styles.resendRow}>
        <Text style={styles.resendText}>메일을 못 받으셨나요? </Text>
        {countdown > 0 ? (
          <Text style={styles.countdown}>{`재발송 (${countdown}초)`}</Text>
        ) : (
          <LinkText label="재발송" onPress={onResend} />
        )}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", marginTop: SPACING.md },
  icon: { fontSize: 44 },
  resendRow: { flexDirection: "row", justifyContent: "center", marginTop: SPACING.lg },
  resendText: { color: NEUTRAL.textMuted, fontSize: 14 },
  countdown: { color: NEUTRAL.textMuted, fontSize: 14 },
});
