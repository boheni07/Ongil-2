import Link from "next/link";
import { StepBar } from "@/components/auth/StepBar";
import { SignupForm } from "@/components/auth/SignupForm";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { AuthCard, AuthLogo, AuthTitle, AuthDesc } from "@/components/auth/AuthShell";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  return (
    <AuthCard width="xwide">
      <AuthLogo />
      <StepBar current={1} />
      <AuthTitle>온길 시작하기</AuthTitle>
      <AuthDesc>역할·기본 정보·약관 동의를 한 화면에서 입력하면 바로 가입돼요.</AuthDesc>

      <SignupForm invite={invite ?? null} />

      <SocialAuthButtons />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-medium text-primary-700 underline">
          로그인
        </Link>
      </p>
    </AuthCard>
  );
}
