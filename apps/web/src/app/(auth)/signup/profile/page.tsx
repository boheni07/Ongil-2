import Link from "next/link";
import { redirect } from "next/navigation";
import { roleSelectSchema } from "@ongil/validation";
import { StepBar } from "@/components/auth/StepBar";
import { ProfileForm } from "@/components/auth/ProfileForm";
import {
  AuthCard,
  AuthDesc,
  AuthTitle,
} from "@/components/auth/AuthShell";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; invite?: string }>;
}) {
  const { role, invite } = await searchParams;
  const parsed = roleSelectSchema.safeParse({ role });
  if (!parsed.success) {
    redirect("/signup");
  }

  return (
    <AuthCard>
      <StepBar current={2} />
      <AuthTitle>기본 정보를 입력해 주세요</AuthTitle>
      <AuthDesc>안전한 계정 생성을 위해 필요한 정보입니다</AuthDesc>

      <ProfileForm role={parsed.data.role} invite={invite ?? null} />

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
