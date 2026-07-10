import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { consentSchema } from "@ongil/validation";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { StepBar } from "../components/StepBar";
import { ErrorBanner, LinkText, PrimaryButton, ScreenTitle } from "../components/ui";
import { NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Consent">;

/**
 * A-08 동의 수집 — PIPA §22/§23. 필수 4종(만14세·약관·개인정보·민감정보) + 선택 마케팅.
 *
 * DB에는 쓰지 않는다: submitProfile(A-04)이 만든 계정은 email-confirm 설정에서
 * signUp 직후 세션이 없어(auth.uid() NULL) consents_insert RLS가 항상 거부한다.
 * 필수 검증만 하고 marketingAgreed 값만 A-05로 넘기며, 실제 INSERT는 VerifyEmailScreen이
 * verifyOtp로 세션을 확보한 직후에 수행한다(웹 submitConsents/insertSignupConsents 패턴).
 */
export function ConsentScreen({ navigation, route }: Props) {
  const { email, invite } = route.params;
  const [ageOver14, setAgeOver14] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const { loading, error, run, setError } = useAsyncAction();

  const allChecked = ageOver14 && terms && privacy && sensitive && marketing;
  const setAll = (v: boolean) => {
    setAgeOver14(v);
    setTerms(v);
    setPrivacy(v);
    setSensitive(v);
    setMarketing(v);
    setError(null);
  };

  const onSubmit = () =>
    run(async () => {
      const parsed = consentSchema.safeParse({
        ageOver14,
        termsAgreed: terms,
        privacyAgreed: privacy,
        sensitiveAgreed: sensitive,
        marketingAgreed: marketing,
      });
      if (!parsed.success) {
        return "필수 항목(만 14세 이상·약관·개인정보·민감정보)에 모두 동의해야 합니다.";
      }

      navigation.navigate("VerifyEmail", {
        email,
        marketingAgreed: parsed.data.marketingAgreed,
        invite,
      });
    });

  return (
    <ScreenScaffold>
      <StepBar current={3} />
      <ScreenTitle
        title="약관 및 개인정보 동의"
        desc="개인정보보호법 제22조에 따라 분리 안내합니다"
      />

      {error ? <ErrorBanner message={error} /> : null}

      <Pressable
        onPress={() => setAll(!allChecked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allChecked }}
        accessibilityLabel="전체 동의 (선택 포함)"
        style={styles.allRow}
      >
        <Box checked={allChecked} />
        <Text style={styles.allText}>전체 동의 (선택 포함)</Text>
      </Pressable>

      <ConsentRow
        label="만 14세 이상입니다"
        required
        checked={ageOver14}
        onToggle={() => setAgeOver14((v) => !v)}
      />
      <ConsentRow
        label="이용약관 동의"
        required
        checked={terms}
        onToggle={() => setTerms((v) => !v)}
        onView={() => navigation.navigate("Terms")}
      />
      <ConsentRow
        label="개인정보 수집·이용 동의"
        required
        checked={privacy}
        onToggle={() => setPrivacy((v) => !v)}
        detail="수집: 이름·이메일·휴대폰·역할 / 목적: 회원 식별·서비스 제공·협력자 연결 / 보유: 탈퇴 후 5년(법령에 따름)"
      />
      <ConsentRow
        label="민감정보(건강·장애) 처리 동의"
        required
        checked={sensitive}
        onToggle={() => setSensitive((v) => !v)}
        onView={() => navigation.navigate("Privacy")}
      />
      <ConsentRow
        label="마케팅·이벤트 수신"
        checked={marketing}
        onToggle={() => setMarketing((v) => !v)}
        detail="서비스 소식·이벤트 안내. 동의하지 않아도 이용 가능하며 언제든 철회할 수 있습니다."
      />

      <View style={{ marginTop: SPACING.sm }}>
        <PrimaryButton label="동의하고 계속" onPress={onSubmit} loading={loading} />
      </View>
    </ScreenScaffold>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.boxOn]}>
      {checked ? <Text style={styles.boxMark}>✓</Text> : null}
    </View>
  );
}

function ConsentRow({
  label,
  required,
  checked,
  onToggle,
  onView,
  detail,
}: {
  label: string;
  required?: boolean;
  checked: boolean;
  onToggle: () => void;
  onView?: () => void;
  detail?: string;
}) {
  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={`${required ? "필수" : "선택"} ${label}`}
          style={styles.itemLabelRow}
        >
          <Box checked={checked} />
          <Text style={[styles.tag, required ? styles.tagReq : styles.tagOpt]}>
            {required ? "필수" : "선택"}
          </Text>
          <Text style={styles.itemLabel}>{label}</Text>
        </Pressable>
        {onView ? <LinkText label="보기" onPress={onView} /> : null}
      </View>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: TOUCH_MIN,
    backgroundColor: PRIMARY[50],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  allText: { fontSize: 15, fontWeight: "700", color: PRIMARY[800] },
  item: {
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemLabelRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1, minHeight: TOUCH_MIN - 12 },
  itemLabel: { fontSize: 14, color: NEUTRAL.text, flexShrink: 1 },
  tag: { fontSize: 11, fontWeight: "700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, overflow: "hidden" },
  tagReq: { color: "#fff", backgroundColor: PRIMARY[600] },
  tagOpt: { color: NEUTRAL.textMuted, backgroundColor: NEUTRAL.surface },
  detail: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: SPACING.sm, lineHeight: 18 },
  box: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: PRIMARY[600], borderColor: PRIMARY[600] },
  boxMark: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
