import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/ProfileForm";

/** 프로필 수정 — GlobalHeader 사용자 메뉴("프로필 수정")·설정 인덱스에서 진입한다. */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("users")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-2xl">
      <h1 className="text-headline-1 font-extrabold text-foreground">프로필 수정</h1>
      <p className="mt-1 text-body text-muted-foreground">이름과 프로필 사진을 변경할 수 있습니다.</p>
      <div className="mt-6">
        <ProfileForm
          email={user.email ?? ""}
          role={data?.role ?? ""}
          fullName={data?.full_name ?? ""}
          avatarUrl={data?.avatar_url ?? null}
        />
      </div>
    </div>
  );
}
