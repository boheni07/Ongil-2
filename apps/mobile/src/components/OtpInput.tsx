import { createRef, useMemo, useRef } from "react";
import {
  type NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  type TextInputKeyPressEventData,
  View,
} from "react-native";
import { NEUTRAL, PRIMARY, RADIUS } from "../theme/colors";

const LENGTH = 6;

/** A-05 이메일 인증 6자리 OTP. 자동 포커스 이동 + 백스페이스 되돌림 지원. */
export function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const refs = useRef(Array.from({ length: LENGTH }, () => createRef<TextInput>()));
  const chars = useMemo(() => {
    const arr = value.split("").slice(0, LENGTH);
    while (arr.length < LENGTH) arr.push("");
    return arr;
  }, [value]);

  const setCharAt = (index: number, char: string) => {
    const digit = char.replace(/[^0-9]/g, "").slice(-1);
    const arr = [...chars];
    arr[index] = digit;
    onChange(arr.join("").slice(0, LENGTH));
    if (digit && index < LENGTH - 1) {
      refs.current[index + 1].current?.focus();
    }
  };

  const handleKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>
  ) => {
    if (e.nativeEvent.key === "Backspace" && !chars[index] && index > 0) {
      refs.current[index - 1].current?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {chars.map((c, i) => (
        <TextInput
          key={i}
          ref={refs.current[i]}
          value={c}
          onChangeText={(t) => setCharAt(i, t)}
          onKeyPress={(e) => handleKeyPress(i, e)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={1}
          accessibilityLabel={`인증코드 ${i + 1}`}
          style={styles.cell}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 16 },
  cell: {
    width: 46,
    height: 56,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: NEUTRAL.text,
    backgroundColor: NEUTRAL.bg,
  },
});

export const OTP_LENGTH = LENGTH;
