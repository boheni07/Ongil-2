import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  permissionGrantSchema,
  type AccessLevel,
  type DomainKey,
  type InviteRole,
  type PermissionGrantInput,
  type Role,
} from "@ongil/validation";
import {
  findGranteeByEmail,
  getPermissionPresets,
  grantPermission,
  type GranteeSummary,
} from "../lib/permissions";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { useWizardDraft } from "../hooks/useWizardDraft";
import { StepBar } from "../components/StepBar";
import { WizardFooter } from "../components/WizardStep";
import { ErrorBanner, InfoBanner } from "../components/ui";
import { DateField } from "../components/DateField";
import { DOMAIN_COLORS, FONT, NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { GuardianStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GuardianStackParamList, "PermissionGrant">;

const STEP_CAPS = ["대상자", "도메인", "수준·기간", "확인"];

const DOMAINS: { key: DomainKey; label: string }[] = [
  { key: "MED", label: "의료" },
  { key: "EDU", label: "교육" },
  { key: "WEL", label: "복지" },
  { key: "DAI", label: "일상" },
  { key: "TRA", label: "전환" },
  { key: "LEG", label: "법률" },
];

const LEVELS: { key: AccessLevel; label: string }[] = [
  { key: "read", label: "읽기" },
  { key: "write", label: "작성" },
  { key: "edit", label: "편집" },
];

const INVITE_ROLES: { key: InviteRole; label: string }[] = [
  { key: "supporter", label: "활동지원사" },
  { key: "teacher", label: "특수교사" },
  { key: "social_worker", label: "사회복지사" },
  { key: "therapist", label: "치료사" },
];

const ROLE_LABEL: Record<Role, string> = {
  person: "당사자",
  guardian: "보호자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Draft {
  step: number;
  email: string;
  grantee: GranteeSummary | null;
  lookupDone: boolean;
  inviteRole: InviteRole | null;
  selectedDomains: DomainKey[];
  levels: Partial<Record<DomainKey, AccessLevel>>;
  validUntil: string;
  indefinite: boolean;
}

/**
 * G-32 권한 부여 4단계 위저드(모바일). Flow-G-02.
 * Step2에서 대상자 role로 프리셋을 불러와 도메인 자동 선택 + 도메인별 프리셋 수준을 기억하고,
 * Step3는 선택된 도메인마다 개별 수준 행을 렌더한다(플랫 단일 라디오가 아님 — 특수교사처럼
 * 도메인마다 프리셋 수준이 다른 실제 요구사항을 반영, 웹과 동일 구조).
 */
export function PermissionGrantScreen({ route, navigation }: Props) {
  const { personId, personName } = route.params;
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [grantee, setGrantee] = useState<GranteeSummary | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [inviteRole, setInviteRole] = useState<InviteRole | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<DomainKey[]>([]);
  const [presetLevels, setPresetLevels] = useState<Partial<Record<DomainKey, AccessLevel>>>({});
  const [levels, setLevels] = useState<Partial<Record<DomainKey, AccessLevel>>>({});
  const [validUntil, setValidUntil] = useState("");
  const [indefinite, setIndefinite] = useState(false);
  const [looking, setLooking] = useState(false);

  const { loading, error, setError, run } = useAsyncAction();
  const { checkRestore, saveDraft, clearDraft } = useWizardDraft<Draft>(
    `permission-grant:${personId}`
  );

  const snapshot = useCallback(
    (): Draft => ({
      step,
      email,
      grantee,
      lookupDone,
      inviteRole,
      selectedDomains,
      levels,
      validUntil,
      indefinite,
    }),
    [step, email, grantee, lookupDone, inviteRole, selectedDomains, levels, validUntil, indefinite]
  );

  const applyDraft = useCallback((d: Draft) => {
    setStep(d.step);
    setEmail(d.email);
    setGrantee(d.grantee);
    setLookupDone(d.lookupDone);
    setInviteRole(d.inviteRole);
    setSelectedDomains(d.selectedDomains);
    setLevels(d.levels);
    setValidUntil(d.validUntil);
    setIndefinite(d.indefinite);
  }, []);

  useEffect(() => {
    void checkRestore(applyDraft);
  }, [checkRestore, applyDraft]);

  useEffect(() => {
    saveDraft(snapshot());
  }, [saveDraft, snapshot]);

  /** 대상자 role — 기존 가입자면 그 role, 미가입 초대면 선택한 inviteRole. */
  const effectiveRole: Role | null = grantee?.role ?? inviteRole;

  /** Step1 이메일 조회 — 가입자면 existing, 없으면 invite 흐름. */
  const lookup = async () => {
    if (!email.trim()) return;
    setLooking(true);
    setError(null);
    const found = await findGranteeByEmail(email);
    setGrantee(found);
    setLookupDone(true);
    setInviteRole(null);
    setLooking(false);
  };

  const resetLookup = () => {
    setGrantee(null);
    setLookupDone(false);
    setInviteRole(null);
  };

  /** Step2 진입 — 대상자 role 프리셋으로 도메인 자동 선택 + 도메인별 프리셋 수준 기억. */
  const loadPresets = async (role: Role) => {
    const presets = await getPermissionPresets(role);
    if (presets.length === 0) return;
    const presetMap: Partial<Record<DomainKey, AccessLevel>> = {};
    for (const p of presets) presetMap[p.domain] = p.accessLevel;
    setPresetLevels(presetMap);
    // 이미 사용자가 도메인을 만졌으면 덮어쓰지 않는다.
    setSelectedDomains((prev) => (prev.length ? prev : presets.map((p) => p.domain)));
    setLevels((prev) => (Object.keys(prev).length ? prev : presetMap));
  };

  const toggleDomain = (d: DomainKey) => {
    setSelectedDomains((prev) => {
      if (prev.includes(d)) {
        setLevels((lv) => {
          const next = { ...lv };
          delete next[d];
          return next;
        });
        return prev.filter((x) => x !== d);
      }
      setLevels((lv) => ({ ...lv, [d]: presetLevels[d] ?? "read" }));
      return [...prev, d];
    });
  };

  const setDomainLevel = (d: DomainKey, level: AccessLevel) => {
    setLevels((prev) => ({ ...prev, [d]: level }));
    if (level === "edit") setIndefinite(false);
  };

  const hasEdit = selectedDomains.some((d) => (levels[d] ?? "read") === "edit");

  const buildInput = (): PermissionGrantInput | null => {
    const domains = selectedDomains.map((d) => ({
      domain: d,
      accessLevel: levels[d] ?? ("read" as AccessLevel),
    }));
    const validUntilVal = indefinite ? null : validUntil.trim();
    if (grantee) {
      return {
        target: "existing",
        granteeUserId: grantee.id,
        domains,
        validUntil: validUntilVal || null,
      };
    }
    if (inviteRole) {
      return {
        target: "invite",
        inviteEmail: email.trim().toLowerCase(),
        inviteRole,
        domains,
        validUntil: validUntilVal || null,
      };
    }
    return null;
  };

  const goNext = async () => {
    if (step === 1) {
      if (effectiveRole) await loadPresets(effectiveRole);
      setStep(2);
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = () =>
    run(async () => {
      const input = buildInput();
      if (!input) return "대상자를 먼저 선택해주세요.";
      const parsed = permissionGrantSchema.safeParse(input);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.";
      const res = await grantPermission(personId, parsed.data);
      if (res.error) return res.error;
      clearDraft();
      navigation.navigate("PermissionMatrix", { personId, personName });
    });

  // 단계별 다음 버튼 활성 조건
  const step1Ready = grantee !== null || (lookupDone && inviteRole !== null);
  const step2Ready = selectedDomains.length > 0;
  const step3Ready = !hasEdit || (DATE_RE.test(validUntil.trim()) && !indefinite);
  const canNext =
    (step === 1 && step1Ready) ||
    (step === 2 && step2Ready) ||
    (step === 3 && step3Ready);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepBar current={step} total={4} label="권한 부여" />
      <Text style={styles.stepCap}>
        {step}/4 · {STEP_CAPS[step - 1]}
      </Text>
      <Text style={styles.personLine}>당사자: {personName}</Text>
      {error ? <ErrorBanner message={error} /> : null}

      {step === 1 && (
        <View>
          <Text style={styles.q}>누구에게 권한을 부여하나요?</Text>
          <Text style={styles.label}>이메일로 대상자 찾기</Text>
          <View style={styles.emailRow}>
            <TextInput
              accessibilityLabel="대상자 이메일"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (lookupDone) resetLookup();
              }}
              placeholder="name@example.com"
              placeholderTextColor={NEUTRAL.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이메일로 대상자 조회"
              accessibilityState={{ disabled: !email.trim() || looking }}
              onPress={lookup}
              disabled={!email.trim() || looking}
              style={({ pressed }) => [
                styles.lookupBtn,
                (!email.trim() || looking) && styles.lookupBtnOff,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.lookupBtnText}>{looking ? "조회 중" : "확인"}</Text>
            </Pressable>
          </View>

          {grantee ? (
            <View style={styles.granteeCard}>
              <Text style={styles.granteeName}>{grantee.fullName}</Text>
              <Text style={styles.granteeRole}>{ROLE_LABEL[grantee.role]} · 기존 가입자</Text>
            </View>
          ) : lookupDone ? (
            <View>
              <InfoBanner message="가입 이력이 없는 이메일입니다. 초대장을 보내 권한을 부여할 수 있습니다." />
              <Text style={styles.label}>초대할 역할</Text>
              <View style={styles.chipWrap}>
                {INVITE_ROLES.map((r) => (
                  <Pressable
                    key={r.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: inviteRole === r.key }}
                    accessibilityLabel={r.label}
                    onPress={() => setInviteRole(r.key)}
                    style={({ pressed }) => [
                      styles.roleChip,
                      inviteRole === r.key && styles.roleChipOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        inviteRole === r.key && styles.roleChipTextOn,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={styles.q}>어떤 도메인에 접근하나요?</Text>
          <Text style={styles.subtle}>
            {effectiveRole ? `${ROLE_LABEL[effectiveRole]} 프리셋을 자동 선택했습니다. ` : ""}
            복수 선택할 수 있습니다.
          </Text>
          <View style={styles.chipWrap}>
            {DOMAINS.map((d) => {
              const on = selectedDomains.includes(d.key);
              const c = DOMAIN_COLORS[d.key];
              return (
                <Pressable
                  key={d.key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={d.label}
                  onPress={() => toggleDomain(d.key)}
                  style={({ pressed }) => [
                    styles.domainChip,
                    { borderColor: on ? c.text : NEUTRAL.border, backgroundColor: on ? c.bg : NEUTRAL.bg },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.domainChipText, { color: on ? c.text : NEUTRAL.textMuted }]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={styles.q}>권한 수준과 유효 기간</Text>
          <Text style={styles.subtle}>도메인마다 접근 수준을 정할 수 있습니다.</Text>

          {selectedDomains.map((d) => {
            const meta = DOMAINS.find((x) => x.key === d);
            const cur = levels[d] ?? "read";
            return (
              <View key={d} style={styles.levelRow}>
                <Text style={styles.levelDomain}>{meta?.label ?? d}</Text>
                <View style={styles.levelBtns}>
                  {LEVELS.map((lv) => {
                    const on = cur === lv.key;
                    return (
                      <Pressable
                        key={lv.key}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${meta?.label ?? d} ${lv.label}`}
                        onPress={() => setDomainLevel(d, lv.key)}
                        style={({ pressed }) => [
                          styles.levelBtn,
                          on && styles.levelBtnOn,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.levelBtnText, on && styles.levelBtnTextOn]}>
                          {lv.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <Text style={[styles.label, { marginTop: SPACING.lg }]}>유효 기간</Text>
          <DateField
            accessibilityLabel="유효 기간 종료일. 예시 2026-12-31"
            value={validUntil}
            onChange={setValidUntil}
            disabled={indefinite}
            style={[styles.input, indefinite && styles.inputDisabled]}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: indefinite, disabled: hasEdit }}
            accessibilityLabel="무기한"
            onPress={() => {
              if (hasEdit) return;
              setIndefinite((v) => !v);
            }}
            disabled={hasEdit}
            style={({ pressed }) => [styles.indefRow, pressed && !hasEdit && styles.pressed]}
          >
            <View style={[styles.checkbox, indefinite && styles.checkboxOn, hasEdit && styles.checkboxOff]}>
              {indefinite ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={[styles.indefLabel, hasEdit && styles.indefLabelOff]}>무기한</Text>
          </Pressable>
          {hasEdit ? (
            <Text style={styles.guardNote}>
              편집(edit) 권한이 포함되어 있어 종료일이 반드시 필요합니다.
            </Text>
          ) : null}
        </View>
      )}

      {step === 4 && (
        <View>
          <Text style={styles.q}>부여 내용 확인</Text>
          <SumRow k="당사자" v={personName} />
          <SumRow
            k="대상자"
            v={
              grantee
                ? `${grantee.fullName} (${ROLE_LABEL[grantee.role]})`
                : `${email.trim()} — 초대 (${inviteRole ? ROLE_LABEL[inviteRole] : "-"})`
            }
          />
          <View style={styles.sumRow}>
            <Text style={styles.sumK}>도메인·수준</Text>
            <View style={{ flex: 1, alignItems: "flex-end", gap: 4 }}>
              {selectedDomains.map((d) => {
                const meta = DOMAINS.find((x) => x.key === d);
                const lv = LEVELS.find((x) => x.key === (levels[d] ?? "read"));
                return (
                  <Text key={d} style={styles.sumV}>
                    {meta?.label} · {lv?.label}
                  </Text>
                );
              })}
            </View>
          </View>
          <SumRow k="유효 기간" v={indefinite ? "무기한" : validUntil.trim() || "-"} />
          <Text style={styles.finalNote}>
            부여 시 대상자에게 알림이 전송되며, 모든 접근은 접근 로그(G-40)에 기록됩니다.
          </Text>
        </View>
      )}

      <WizardFooter
        onPrev={step > 1 ? () => setStep((s) => s - 1) : () => navigation.goBack()}
        onNext={step < 4 ? goNext : undefined}
        onSubmit={step === 4 ? submit : undefined}
        nextDisabled={!canNext}
        loading={loading}
      />
    </ScrollView>
  );
}

function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumK}>{k}</Text>
      <Text style={styles.sumV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NEUTRAL.bg },
  content: { padding: SPACING.xl },
  stepCap: { fontSize: FONT.h3, fontWeight: "700", color: PRIMARY[700], marginBottom: SPACING.xs },
  personLine: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginBottom: SPACING.md },
  q: { fontSize: 22, fontWeight: "800", color: NEUTRAL.text, marginBottom: SPACING.sm },
  subtle: { fontSize: FONT.body, color: NEUTRAL.textMuted, marginBottom: SPACING.md },
  label: { fontSize: 15, fontWeight: "600", color: NEUTRAL.text, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: NEUTRAL.text,
    backgroundColor: NEUTRAL.bg,
  },
  inputDisabled: { backgroundColor: NEUTRAL.surface, color: NEUTRAL.textMuted },
  emailRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
  lookupBtn: {
    minHeight: 48,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: PRIMARY[600],
    alignItems: "center",
    justifyContent: "center",
  },
  lookupBtnOff: { backgroundColor: PRIMARY[400] },
  lookupBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  granteeCard: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: PRIMARY[600],
    backgroundColor: PRIMARY[50],
  },
  granteeName: { fontSize: FONT.h3, fontWeight: "800", color: NEUTRAL.text },
  granteeRole: { fontSize: FONT.caption, fontWeight: "600", color: PRIMARY[700], marginTop: 2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  roleChip: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.bg,
  },
  roleChipOn: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[50] },
  roleChipText: { fontSize: 14, fontWeight: "600", color: NEUTRAL.textMuted },
  roleChipTextOn: { color: PRIMARY[800] },
  domainChip: {
    minHeight: 44,
    paddingHorizontal: SPACING.lg,
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: RADIUS.md,
  },
  domainChipText: { fontSize: 15, fontWeight: "700" },
  levelRow: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
  },
  levelDomain: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.sm },
  levelBtns: { flexDirection: "row", gap: SPACING.sm },
  levelBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    backgroundColor: NEUTRAL.bg,
  },
  levelBtnOn: { borderColor: PRIMARY[600], backgroundColor: PRIMARY[600] },
  levelBtnText: { fontSize: 14, fontWeight: "700", color: NEUTRAL.textMuted },
  levelBtnTextOn: { color: "#fff" },
  indefRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: SPACING.md },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: NEUTRAL.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: PRIMARY[600], borderColor: PRIMARY[600] },
  checkboxOff: { backgroundColor: NEUTRAL.surface, borderColor: NEUTRAL.border },
  checkMark: { color: "#fff", fontSize: 16, fontWeight: "800" },
  indefLabel: { fontSize: 15, fontWeight: "600", color: NEUTRAL.text },
  indefLabelOff: { color: NEUTRAL.textMuted },
  guardNote: { fontSize: FONT.caption, color: NEUTRAL.danger, marginTop: SPACING.sm },
  pressed: { opacity: 0.85 },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: NEUTRAL.border,
  },
  sumK: { fontSize: 14, color: NEUTRAL.textMuted },
  sumV: { flex: 1, fontSize: 14, fontWeight: "600", color: NEUTRAL.text, textAlign: "right" },
  finalNote: { fontSize: FONT.caption, color: NEUTRAL.textMuted, marginTop: SPACING.lg, lineHeight: 18 },
});
