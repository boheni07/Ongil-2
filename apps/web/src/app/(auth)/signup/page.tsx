import Link from "next/link";
import { StepBar } from "@/components/auth/StepBar";
import { RoleSelectGrid } from "@/components/auth/RoleSelectGrid";
import {
  AuthCard,
  AuthDesc,
  AuthLogo,
  AuthTitle,
} from "@/components/auth/AuthShell";

export default async function SignupRolePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  return (
    <AuthCard width="wide">
      <AuthLogo />
      <StepBar current={1} />
      <AuthTitle>어떤 역할로 시작하시나요?</AuthTitle>
      <AuthDesc>
        역할에 맞는 화면과 기능을 제공해 드립니다. 나중에 변경할 수 있어요.
      </AuthDesc>

      <RoleSelectGrid invite={invite ?? null} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-medium text-primary-700 underline">
          로그인
        </Link>
      </p>
    </AuthCard>
  );
}
