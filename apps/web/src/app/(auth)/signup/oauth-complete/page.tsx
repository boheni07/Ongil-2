import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthCard, AuthLogo, AuthTitle, AuthDesc } from "@/components/auth/AuthShell";
import { OAuthCompleteForm } from "@/components/auth/OAuthCompleteForm";

/**
 * A-03+A-08 소셜 온보딩 완료 화면 — apps/web/src/lib/oauth-bridge.ts가 신규 계정 세션만
 * 성립시킨 뒤 여기로 보낸다. 세션이 없으면(직접 URL 접근 등) 가입 시작 화면으로 되돌린다.
 */
export default async function OAuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signup");
  }

  return (
    <AuthCard width="wide">
      <AuthLogo />
      <AuthTitle>거의 다 됐어요</AuthTitle>
      <AuthDesc>어떤 역할로 시작할지 선택하고, 약관에 동의해주세요.</AuthDesc>

      <OAuthCompleteForm invite={invite ?? null} />
    </AuthCard>
  );
}
