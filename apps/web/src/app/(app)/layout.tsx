import { Home, FileText, Settings, LayoutDashboard, PencilLine, ArrowLeftRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { Sidebar, type SidebarItem } from "@/components/layout/Sidebar";

function sidebarItems(role: string | null): SidebarItem[] {
  if (role === "guardian") {
    return [
      { label: "대시보드", href: "/dashboard", icon: LayoutDashboard },
      { label: "기록", href: "/records", icon: FileText },
      { label: "설정", href: "/settings", icon: Settings },
    ];
  }
  if (role === "supporter") {
    return [
      { label: "홈", href: "/home", icon: Home },
      { label: "일지 작성", href: "/journals/new", icon: PencilLine },
      { label: "인수인계", href: "/handovers", icon: ArrowLeftRight },
      { label: "설정", href: "/settings", icon: Settings },
    ];
  }
  return [
    { label: "홈", href: "/home", icon: Home },
    { label: "기록", href: "/records", icon: FileText },
    { label: "설정", href: "/settings", icon: Settings },
  ];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  let role: string | null = null;

  if (user) {
    const { data } = await supabase
      .from("users")
      .select("full_name, role, deactivated_at")
      .eq("id", user.id)
      .maybeSingle();
    fullName = data?.full_name ?? null;
    role = data?.role ?? null;
    // 재로그인 시 비활성화 해제(§settings/privacy "다시 로그인하면 해제됩니다" 안내와 대응).
    if (data?.deactivated_at) {
      await supabase.from("users").update({ deactivated_at: null }).eq("id", user.id);
    }
  }

  // 당사자 모드(§7-1): 사이드바 없이 중앙 정렬 단일 컬럼 폰 셸, 넉넉한 여백.
  if (role === "person") {
    return (
      <div className="flex flex-1 flex-col bg-primary-50/20">
        <GlobalHeader userName={fullName ?? user?.email ?? null} />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      <GlobalHeader userName={fullName ?? user?.email ?? null} />
      <div className="flex flex-1">
        <Sidebar items={sidebarItems(role)} />
        <main className="flex flex-1 flex-col bg-[#fafaf9] px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
