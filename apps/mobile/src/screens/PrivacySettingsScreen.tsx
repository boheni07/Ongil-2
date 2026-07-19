import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  OPTIONAL_CONSENT_TYPES,
  REQUIRED_CONSENT_TYPES,
  isOptionalConsent,
  type ConsentType,
} from "@ongil/validation";
import { supabase } from "../lib/supabase";
import {
  exportMyData,
  getMyConsentStatus,
  getReacquisitionTargets,
  reacquireConsent,
  withdrawAllConsentsAndDeactivate,
  withdrawOptionalConsent,
  type ConsentStatus,
  type ReacquisitionTarget,
} from "../lib/consents";
import { ErrorBanner } from "../components/ui";
import { FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";

/**
 * G-65(보호자) / P-23(당사자) 공용 동의·권리 관리 화면.
 * 역할 분기는 데이터로 처리한다 — 재취득 섹션은 getReacquisitionTargets()가
 * 셀프가입 성년 당사자에게만 값을 돌려주므로(그 외 항상 빈 배열), 빈 배열이면 통째로 숨긴다.
 *
 * "동의 전체철회 및 계정 비활성화"는 계정 삭제가 아니다(문구를 "탈퇴"로 쓰지 않는다).
 */

/** consent_type 한글 라벨 — 온보딩 ConsentScreen 문구와 동일. unique_id만 추가. */
const CONSENT_LABELS: Record<ConsentType, string> = {
  terms: "이용약관",
  privacy: "개인정보 수집·이용",
  sensitive: "민감정보(건강·장애) 처리",
  unique_id: "고유식별정보 처리",
  marketing: "마케팅·이벤트 수신",
};

/** 필수 먼저, 그다음 선택 순으로 정렬(존재하는 행만). */
const TYPE_ORDER: ConsentType[] = [...REQUIRED_CONSENT_TYPES, ...OPTIONAL_CONSENT_TYPES];

function currentState(s: ConsentStatus): { label: string; on: boolean } {
  if (s.revokedAt) return { label: "철회됨", on: false };
  if (s.isAgreed) return { label: "동의함", on: true };
  return { label: "미동의", on: false };
}

export function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const [initialLoading, setInitialLoading] = useState(true);
  const [statuses, setStatuses] = useState<ConsentStatus[]>([]);
  const [targets, setTargets] = useState<ReacquisitionTarget[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([getMyConsentStatus(), getReacquisitionTargets()]);
    s.sort((a, b) => TYPE_ORDER.indexOf(a.consentType) - TYPE_ORDER.indexOf(b.consentType));
    setStatuses(s);
    setTargets(t);
    setInitialLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const runAction = async (
    key: string,
    fn: () => Promise<{ error?: string } | void>
  ) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    const res = await fn();
    if (res && res.error) {
      setError(res.error);
      setBusy(null);
      return;
    }
    await load();
    setBusy(null);
  };

  const onWithdrawOptional = (type: ConsentType) =>
    runAction(`withdraw:${type}`, () => withdrawOptionalConsent(type));

  const onReacquire = (type: ConsentType) =>
    runAction(`reacquire:${type}`, () => reacquireConsent(type));

  const onExport = () =>
    runAction("export", async () => {
      const data = await exportMyData();
      if ("error" in data) return { error: data.error };
      try {
        await Share.share({ message: JSON.stringify(data, null, 2) });
      } catch {
        // 사용자가 공유 시트를 취소한 경우 — 오류 아님.
      }
    });

  const doWithdrawAll = async () => {
    setBusy("withdrawAll");
    setError(null);
    const res = await withdrawAllConsentsAndDeactivate();
    if (res.error) {
      setError(res.error);
      setBusy(null);
      return;
    }
    Alert.alert(
      "완료",
      "모든 동의가 철회되고 계정이 비활성화되었습니다.",
      [{ text: "확인", onPress: () => void supabase.auth.signOut() }],
      { cancelable: false }
    );
  };

  const confirmWithdrawAll = () =>
    Alert.alert(
      "동의 전체철회 및 계정 비활성화",
      "모든 동의를 철회하고 계정을 비활성화합니다. 저장된 기록은 삭제되지 않지만, 이후 서비스를 이용할 수 없습니다. 계속하시겠어요?",
      [
        { text: "취소", style: "cancel" },
        { text: "전체철회·비활성화", style: "destructive", onPress: () => void doWithdrawAll() },
      ]
    );

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PRIMARY[600]} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <Text style={styles.title}>개인정보 및 동의 관리</Text>
      <Text style={styles.subtle}>내 동의 현황을 확인하고 권리를 행사할 수 있습니다.</Text>

      {error ? <ErrorBanner message={error} /> : null}

      {/* ── 내 동의 현황 ───────────────────────────── */}
      <Text style={styles.sectionTitle}>내 동의 현황</Text>
      {statuses.length === 0 ? (
        <Text style={styles.muted}>표시할 동의 내역이 없습니다.</Text>
      ) : (
        statuses.map((s) => {
          const state = currentState(s);
          const optional = isOptionalConsent(s.consentType);
          const canWithdraw = optional && state.on;
          const withdrawing = busy === `withdraw:${s.consentType}`;
          return (
            <View key={s.consentType} style={styles.row}>
              <View style={styles.rowMain}>
                <View style={styles.rowHead}>
                  <Text
                    style={[styles.tag, optional ? styles.tagOpt : styles.tagReq]}
                    accessibilityLabel={optional ? "선택 동의" : "필수 동의"}
                  >
                    {optional ? "선택" : "필수"}
                  </Text>
                  <Text style={styles.rowLabel}>{CONSENT_LABELS[s.consentType]}</Text>
                </View>
                <Text
                  style={[styles.stateBadge, state.on ? styles.stateOn : styles.stateOff]}
                  accessibilityLabel={`상태 ${state.label}`}
                >
                  {state.label}
                </Text>
              </View>
              {canWithdraw ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${CONSENT_LABELS[s.consentType]} 동의 철회`}
                  accessibilityState={{ busy: withdrawing }}
                  disabled={busy !== null}
                  onPress={() => onWithdrawOptional(s.consentType)}
                  style={({ pressed }) => [styles.withdrawBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.withdrawBtnText}>
                    {withdrawing ? "철회 중…" : "철회"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}
      <Text style={styles.hint}>
        필수 동의는 서비스 이용에 반드시 필요하여 개별 철회할 수 없습니다. 선택 동의(마케팅)만
        언제든 철회할 수 있습니다.
      </Text>

      {/* ── 성년 전환 · 본인 동의 재취득 (person + 대상 있을 때만) ── */}
      {targets.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>성년 전환 · 본인 동의 재취득</Text>
          <Text style={styles.hint}>
            성년이 되어 보호자가 대신 동의했던 항목을 본인 명의로 다시 동의할 수 있습니다.
          </Text>
          {targets.map((t) => {
            const reacquiring = busy === `reacquire:${t.consentType}`;
            return (
              <View key={t.consentType} style={styles.row}>
                <View style={styles.rowMain}>
                  <View style={styles.rowHead}>
                    <Text style={[styles.tag, styles.tagReq]}>필수</Text>
                    <Text style={styles.rowLabel}>{CONSENT_LABELS[t.consentType]}</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${CONSENT_LABELS[t.consentType]} 본인 동의합니다`}
                  accessibilityState={{ busy: reacquiring }}
                  disabled={busy !== null}
                  onPress={() => onReacquire(t.consentType)}
                  style={({ pressed }) => [styles.reacquireBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.reacquireBtnText}>
                    {reacquiring ? "처리 중…" : "동의합니다"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}

      {/* ── 데이터 내보내기 ───────────────────────────── */}
      <Text style={styles.sectionTitle}>내 데이터 내보내기</Text>
      <Text style={styles.hint}>
        내 계정·동의 내역과 관리 중인 당사자 정보를 JSON으로 내보냅니다(개인정보보호법 열람권).
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="내 데이터 내보내기"
        accessibilityState={{ busy: busy === "export" }}
        disabled={busy !== null}
        onPress={onExport}
        style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}
      >
        <Text style={styles.exportBtnText}>
          {busy === "export" ? "준비 중…" : "📤 데이터 내보내기"}
        </Text>
      </Pressable>

      {/* ── 정정·삭제 요청(프로토타입 app-guardian.html G-65 "✏️ 정정·삭제 요청") ─────────
          별도 요청 접수·처리 워크플로우 자체가 설계된 적이 없어(웹 PrivacySettingsClient.tsx와
          동일 결정), 이미 legal/privacy에 명시된 개인정보보호책임자 연락처로 안내한다. */}
      <Text style={styles.sectionTitle}>개인정보 정정·삭제 요청</Text>
      <Text style={styles.hint}>
        위 목록에 없는 개인정보의 정정·삭제가 필요하면 개인정보보호책임자에게 요청할 수 있습니다.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="정정·삭제 요청 메일 보내기"
        onPress={() =>
          void Linking.openURL(
            "mailto:privacy@ongil.example?subject=" +
              encodeURIComponent("[온길] 개인정보 정정·삭제 요청")
          )
        }
        style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}
      >
        <Text style={styles.exportBtnText}>✏️ 정정·삭제 요청</Text>
      </Pressable>

      {/* ── 위험 액션 ───────────────────────────── */}
      <View style={styles.dangerBox}>
        <Text style={styles.dangerTitle}>동의 전체철회 및 계정 비활성화</Text>
        <Text style={styles.dangerDesc}>
          모든 동의를 철회하고 계정을 비활성화합니다. 계정이 삭제되는 것은 아니며 저장된 기록은
          남지만, 이후 서비스를 이용할 수 없습니다. 다시 로그인하면 비활성화는 해제되지만 철회된
          동의는 자동으로 복구되지 않으니, 서비스를 계속 이용하려면 필수 동의를 다시 진행해야
          할 수 있습니다.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="동의 전체철회 및 계정 비활성화"
          accessibilityState={{ busy: busy === "withdrawAll" }}
          disabled={busy !== null}
          onPress={confirmWithdrawAll}
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
        >
          <Text style={styles.dangerBtnText}>
            {busy === "withdrawAll" ? "처리 중…" : "동의 전체철회 및 계정 비활성화"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg },
  title: { fontSize: FONT.h2, fontWeight: "800", color: NEUTRAL.text },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginTop: 4, marginBottom: SPACING.md },
  sectionTitle: {
    fontSize: FONT.h3,
    fontWeight: "800",
    color: NEUTRAL.text,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  muted: { fontSize: FONT.body, color: NEUTRAL.textMuted },
  hint: { fontSize: FONT.caption, color: NEUTRAL.textMuted, marginTop: SPACING.sm, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  rowMain: { flex: 1, gap: SPACING.xs },
  rowHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  rowLabel: { fontSize: FONT.body, fontWeight: "600", color: NEUTRAL.text, flexShrink: 1 },
  tag: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
  },
  tagReq: { color: "#fff", backgroundColor: PRIMARY[600] },
  tagOpt: { color: NEUTRAL.textMuted, backgroundColor: NEUTRAL.surface },
  stateBadge: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  stateOn: { color: PRIMARY[800], backgroundColor: PRIMARY[100] },
  stateOff: { color: NEUTRAL.textMuted, backgroundColor: NEUTRAL.surface },
  withdrawBtn: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: NEUTRAL.danger,
  },
  withdrawBtnText: { fontSize: 14, fontWeight: "700", color: NEUTRAL.danger },
  reacquireBtn: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
  },
  reacquireBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  exportBtn: {
    marginTop: SPACING.md,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: PRIMARY[400],
    backgroundColor: PRIMARY[50],
  },
  exportBtnText: { fontSize: 16, fontWeight: "700", color: PRIMARY[700] },
  pressed: { opacity: 0.85 },
  dangerBox: {
    marginTop: SPACING.xl,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.dangerBg,
    borderWidth: 1,
    borderColor: "#F3C0C0",
  },
  dangerTitle: { fontSize: FONT.h3, fontWeight: "800", color: NEUTRAL.danger },
  dangerDesc: { fontSize: FONT.caption, color: NEUTRAL.text, marginTop: SPACING.sm, lineHeight: 18 },
  dangerBtn: {
    marginTop: SPACING.md,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.danger,
  },
  dangerBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
