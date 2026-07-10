import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING, TOUCH_MIN } from "../theme/colors";

export function ScreenTitle({ title, desc, center }: { title: string; desc?: string; center?: boolean }) {
  return (
    <View style={{ gap: SPACING.xs, marginBottom: SPACING.lg }}>
      <Text style={[styles.title, center && styles.center]}>{title}</Text>
      {desc ? <Text style={[styles.desc, center && styles.center]}>{desc}</Text> : null}
    </View>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, hint, error, ...inputProps },
  ref
) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={NEUTRAL.textMuted}
        style={[styles.input, error ? styles.inputError : null]}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btnPrimary,
        isDisabled && styles.btnDisabled,
        pressed && !isDisabled && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.btnPrimaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]}
    >
      <Text style={styles.btnGhostText}>{label}</Text>
    </Pressable>
  );
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

export function InfoBanner({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, styles.infoBanner]}>
      <Text style={[styles.bannerText, styles.infoBannerText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  title: { fontSize: FONT.h2, fontWeight: "700", color: NEUTRAL.text },
  desc: { fontSize: FONT.body, color: NEUTRAL.textMuted, lineHeight: 20 },
  label: { fontSize: FONT.label, fontWeight: "600", color: NEUTRAL.text, marginBottom: 6 },
  input: {
    minHeight: TOUCH_MIN,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT.body + 2,
    color: NEUTRAL.text,
    backgroundColor: NEUTRAL.bg,
  },
  inputError: { borderColor: NEUTRAL.danger },
  hint: { fontSize: FONT.caption, color: NEUTRAL.textMuted, marginTop: 4 },
  errorText: { fontSize: FONT.caption, color: NEUTRAL.danger, marginTop: 4 },
  btnPrimary: {
    minHeight: TOUCH_MIN + 4,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  btnPrimaryText: { color: "#fff", fontSize: FONT.h3, fontWeight: "700" },
  btnDisabled: { backgroundColor: PRIMARY[400] },
  btnPressed: { opacity: 0.85 },
  btnGhost: {
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  btnGhostText: { color: NEUTRAL.textMuted, fontSize: FONT.body + 2, fontWeight: "600" },
  link: { color: PRIMARY[600], fontSize: FONT.body, fontWeight: "600" },
  banner: {
    backgroundColor: NEUTRAL.dangerBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  bannerText: { color: NEUTRAL.danger, fontSize: FONT.body },
  infoBanner: { backgroundColor: PRIMARY[50] },
  infoBannerText: { color: PRIMARY[700] },
});
