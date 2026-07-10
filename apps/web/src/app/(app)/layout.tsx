import { Home, FileText, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  let role: string | null = null;

  if (user) {
    const { data } = await supabase.from("users").select("full_name, role").eq("id", user.id).maybeSingle();
    fullName = data?.full_name ?? null;
    role = data?.role ?? null;
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      <GlobalHeader userName={fullName ?? user?.email ?? null} />
      <div className="flex flex-1">
        <Sidebar
          items={[
            { label: "홈", href: "/home", icon: Home, active: true },
            { label: "기록", href: "/records", icon: FileText },
            { label: "설정", href: "/settings", icon: Settings },
          ]}
        />
        <main className="flex flex-1 flex-col px-6 py-10">
          {role ? (
            <p className="mb-4 text-caption text-accent-pebble">현재 역할: {role}</p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
