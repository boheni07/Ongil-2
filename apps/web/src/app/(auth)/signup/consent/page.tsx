import Link from "next/link";
import { StepBar } from "@/components/auth/StepBar";
import { ConsentForm } from "@/components/auth/ConsentForm";
import {
  AuthCard,
  AuthDesc,
  AuthTitle,
} from "@/components/auth/AuthShell";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  return (
    <AuthCard width="wide">
      <StepBar current={3} />
      <AuthTitle>약관 및 개인정보 동의</AuthTitle>
      <AuthDesc>
        개인정보보호법 제22조에 따라 필수·선택 동의를 분리해 안내합니다
      </AuthDesc>

      <ConsentForm invite={invite ?? null} />

      <div className="mt-4 text-center">
        <Link
          href="/signup"
          className="text-sm text-muted-foreground underline"
        >
          ← 이전
        </Link>
      </div>
    </AuthCard>
  );
}
