import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { inviteAcceptSchema, type Role } from "@ongil/validation";
import { supabase } from "../lib/supabase";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { ScreenScaffold } from "../components/ScreenScaffold";
import {
  ErrorBanner,
  GhostButton,
  InfoBanner,
  PrimaryButton,
  ScreenTitle,
} from "../components/ui";
import { NEUTRAL, PRIMARY, RADIUS, SPACING } from "../theme/colors";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "InviteAccept">;

interface InvitePreview {
  role: Role;
  domainGrants: { domain: string; access_level: string }[];
  validUntil: string | null;
  personName: string | null;
}

/**
 * A-06 초대 수락.
 * 미로그인(anon) 상태에서는 invitations RLS가 authenticated 한정이라 미리보기를 조회할 수
 * 없다(알려진 제약 — 보고 참조). 이 경우 웹 acceptInvite와 동일하게 회원가입 위저드로
 * 토큰을 이어 보낸다. 로그인 상태면 accept_invitation RPC로 즉시 권한을 전개한다.
 */
export function InviteAcceptScreen({ navigation, route }: Props) {
  const { token } = route.params;
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const { loading, error, run } = useAsyncAction();

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("invitations")
        .select("role, domain_grants, valid_until, person:persons(full_name)")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();
      if (!active) return;
      if (!data) {
        setPreviewUnavailable(true);
        return;
      }
      const person = data.person as { full_name: string } | { full_name: string }[] | null;
      const personName = Array.isArray(person)
        ? (person[0]?.full_name ?? null)
        : (person?.full_name ?? null);
      setPreview({
        role: data.role as Role,
        domainGrants:
          (data.domain_grants as { domain: string; access_level: string }[]) ?? [],
        validUntil: (data.valid_until as string | null) ?? null,
        personName,
      });
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const onAccept = () =>
    run(async () => {
      const parsed = inviteAcceptSchema.safeParse({ token });
      if (!parsed.success) return "올바르지 않은 초대 링크입니다.";

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // 미가입자: 역할 고정 회원가입으로 토큰 전달(웹 acceptInvite 미로그인 분기와 동일).
        navigation.navigate("RoleSelect", { invite: parsed.data.token });
        return;
      }

      const { error: rpcError } = await supabase.rpc("accept_invitation", {
        p_token: parsed.data.token,
      });
      if (rpcError) return rpcError.message;
      // 세션 존재 → App이 이미 메인을 렌더 중. 스택을 닫는다.
      navigation.popToTop();
    });

  const onDecline = () =>
    run(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return "거절하려면 로그인이 필요합니다.";

      const { data, error: updateError } = await supabase
        .from("invitations")
        .update({ status: "declined" })
        .eq("token", token)
        .eq("status", "pending")
        .select("id");
      if (updateError) return updateError.message;
      if (!data || data.length === 0) return "거절할 수 있는 초대가 없습니다.";
      navigation.popToTop();
    });

  return (
    <ScreenScaffold>
      <ScreenTitle title="초대를 받으셨습니다" desc="내용을 확인하고 수락하세요" center />

      {error ? <ErrorBanner message={error} /> : null}

      {preview ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>부여될 권한</Text>
          <Row label="연결 역할" value={ROLE_LABEL[preview.role]} />
          {preview.domainGrants.map((g) => (
            <Row
              key={g.domain}
              label={DOMAIN_LABEL[g.domain] ?? g.domain}
              value={ACCESS_LABEL[g.access_level] ?? g.access_level}
            />
          ))}
          {preview.validUntil ? <Row label="유효 기간" value={preview.validUntil} /> : null}
          {preview.personName ? <Row label="당사자" value={preview.personName} /> : null}
        </View>
      ) : previewUnavailable ? (
        <InfoBanner message="미리보기는 로그인 후 확인할 수 있습니다. 회원가입을 완료하면 초대가 자동으로 연결됩니다." />
      ) : null}

      <PrimaryButton label="초대 수락하기" onPress={onAccept} loading={loading} />
      <View style={{ marginTop: SPACING.sm }}>
        <GhostButton label="거절" onPress={onDecline} />
      </View>
    </ScreenScaffold>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  person: "당사자",
  guardian: "보호자",
  supporter: "활동지원사",
  teacher: "특수교사",
  social_worker: "사회복지사",
  therapist: "치료사",
};

/** DB Domain enum(대문자) → 표시 라벨. 웹 invite/[token]/page.tsx와 동일. */
const DOMAIN_LABEL: Record<string, string> = {
  MED: "의료 MED",
  EDU: "교육 EDU",
  WEL: "복지 WEL",
  DAI: "일상 DAI",
  TRA: "전환 TRA",
  LEG: "법률 LEG",
};

/** access_level enum(read/write/edit) → 표시 라벨. */
const ACCESS_LABEL: Record<string, string> = {
  read: "읽기",
  write: "읽기 · 쓰기",
  edit: "읽기 · 쓰기 · 편집",
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: PRIMARY[50],
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: NEUTRAL.text, marginBottom: SPACING.sm },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { fontSize: 14, color: NEUTRAL.textMuted },
  rowValue: { fontSize: 14, fontWeight: "600", color: NEUTRAL.text },
});
