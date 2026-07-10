import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StepBar } from "@/components/auth/StepBar";
import { OtpInput } from "@/components/auth/OtpInput";
import {
  AuthCard,
  AuthDesc,
  AuthTitle,
} from "@/components/auth/AuthShell";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; marketing?: string }>;
}) {
  const { invite, marketing } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/signup");
  }

  return (
    <AuthCard>
      <StepBar current={4} />
      <div
        aria-hidden="true"
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-2xl"
      >
        ✉️
      </div>
      <AuthTitle>이메일을 확인해 주세요</AuthTitle>
      <AuthDesc>
        <b className="text-foreground">{user.email}</b> 으로 보낸 6자리 인증 코드를
        입력하세요
      </AuthDesc>

      <OtpInput email={user.email} invite={invite ?? null} marketing={marketing === "1"} />
    </AuthCard>
  );
}
