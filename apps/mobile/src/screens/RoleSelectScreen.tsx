import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Role } from "@ongil/validation";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { StepBar } from "../components/StepBar";
import { ROLE_OPTIONS, RoleCard } from "../components/RoleCard";
import { ErrorBanner, PrimaryButton, ScreenTitle } from "../components/ui";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "RoleSelect">;

/** A-03 역할 선택 — 6역할 세로 카드, 단일 선택 후 A-04로 role 전달. */
export function RoleSelectScreen({ navigation, route }: Props) {
  const invite = route.params?.invite;
  const [selected, setSelected] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onNext = () => {
    if (!selected) {
      setError("역할을 선택해주세요.");
      return;
    }
    navigation.navigate("Profile", { role: selected, invite });
  };

  return (
    <ScreenScaffold>
      <StepBar current={1} />
      <ScreenTitle
        title="역할을 선택하세요"
        desc="역할에 맞는 화면을 제공합니다. 나중에 변경할 수 있어요."
      />

      {error ? <ErrorBanner message={error} /> : null}

      {ROLE_OPTIONS.map((opt) => (
        <RoleCard
          key={opt.role}
          option={opt}
          selected={selected === opt.role}
          onPress={() => {
            setSelected(opt.role);
            setError(null);
          }}
        />
      ))}

      <PrimaryButton label="다음" onPress={onNext} />
    </ScreenScaffold>
  );
}
