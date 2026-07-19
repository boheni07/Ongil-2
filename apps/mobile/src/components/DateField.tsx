import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { formatDateInput } from "../lib/format";
import { NEUTRAL } from "../theme/colors";

/**
 * 날짜 입력 공용 컴포넌트(2026-07-19, 웹 DateField와 동일 방식을 모바일에 이식).
 * 1) 직접 타이핑: 숫자만 받아 "YYYY-MM-DD"로 실시간 자동 변환.
 * 2) 달력 아이콘 → 네이티브 DateTimePicker(안드로이드는 자체 모달로 자동 닫힘,
 *    iOS는 스피너를 인라인으로 펼치고 "완료" 버튼으로 닫는다 — 두 OS의 기본 동작 차이를
 *    그대로 따른다).
 * value/onChange는 항상 "YYYY-MM-DD"(빈 값이면 "") 문자열을 주고받는다.
 */
export function DateField({
  value,
  onChange,
  style,
  placeholder = "YYYY-MM-DD",
  accessibilityLabel,
  min,
  max,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<TextStyle>;
  placeholder?: string;
  accessibilityLabel?: string;
  /** "YYYY-MM-DD" — 시작일/종료일 등 범위 제약. 완성된 값을 실시간으로 이 범위에 clamp한다. */
  min?: string;
  max?: string;
  disabled?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  function clampToRange(iso: string): string {
    if (min && iso < min) return min;
    if (max && iso > max) return max;
    return iso;
  }

  function handlePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setShowPicker(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(clampToRange(selected.toISOString().slice(0, 10)));
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date();

  return (
    <View>
      <View style={styles.wrap}>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          value={value}
          onChangeText={(raw) => onChange(formatDateInput(raw, min, max))}
          placeholder={placeholder}
          placeholderTextColor={NEUTRAL.textMuted}
          keyboardType="number-pad"
          maxLength={10}
          editable={!disabled}
          style={[style, styles.input]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="달력에서 날짜 선택"
          onPress={() => !disabled && setShowPicker(true)}
          disabled={disabled}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Text style={styles.icon}>📅</Text>
        </Pressable>
      </View>

      {showPicker && Platform.OS === "android" && (
        <DateTimePicker
          value={parsed}
          mode="date"
          display="default"
          onChange={handlePickerChange}
          minimumDate={min ? new Date(`${min}T00:00:00`) : undefined}
          maximumDate={max ? new Date(`${max}T00:00:00`) : undefined}
        />
      )}

      {showPicker && Platform.OS === "ios" && (
        <View style={styles.iosPicker}>
          <DateTimePicker
            value={parsed}
            mode="date"
            display="spinner"
            onChange={handlePickerChange}
            minimumDate={min ? new Date(`${min}T00:00:00`) : undefined}
            maximumDate={max ? new Date(`${max}T00:00:00`) : undefined}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="날짜 선택 완료"
            onPress={() => setShowPicker(false)}
            style={styles.doneBtn}
          >
            <Text style={styles.doneText}>완료</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", justifyContent: "center" },
  input: { paddingRight: 44 },
  iconBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 18 },
  iosPicker: { backgroundColor: NEUTRAL.surface, borderRadius: 12, marginTop: 8, paddingBottom: 8 },
  doneBtn: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 8 },
  doneText: { color: "#1D9E75", fontWeight: "700", fontSize: 15 },
});
