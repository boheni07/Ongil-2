import {
  Home,
  FileText,
  LayoutDashboard,
  PencilLine,
  ArrowLeftRight,
  TrendingUp,
  FolderOpen,
  Lock,
  ScrollText,
  Settings,
  ClipboardList,
  Eye,
  BarChart3,
  Compass,
  Clock,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { Sidebar, type SidebarItem } from "@/components/layout/Sidebar";
import { AccountSwitcher } from "@/components/layout/AccountSwitcher";
import { getUnreadNotificationCount } from "@/app/(app)/notifications/actions";

/**
 * 2026-07-19: `/prototypes` 5개 역할 사이드바(web-guardian/teacher/social-worker/therapist/
 * supporter.html) 원문을 그대로 옮겼다 — 항목 라벨·순서·"설정"(보호자는 "동의·권리 관리")
 * 포함까지 프로토타입과 1:1. 프로토타입은 헤더의 "당사자 선택" 드롭다운으로 사이드바 항목이
 * 참조하는 "현재 당사자"를 바꾸는 구조인데, 실제 구현엔 그 전역 선택 상태가 없어 보호자의
 * 당사자별 항목(타임라인/기록 관리/권한 관리/접근 로그)은 첫 번째 당사자로 기본 연결한다
 * (여러 당사자 전환은 기존처럼 대시보드의 PersonSlider에서). 특수교사 "IEP 점검"·사회복지사
 * "ISP 점검"은 특정 기록을 골라야 하는 화면이라 목록 랜딩 페이지가 없어 홈(담당 학생/당사자
 * 카드에서 개별 점검 진입)으로 연결한다 — 다른 항목은 전부 프로토타입과 동일하게 독립 화면으로
 * 바로 연결된다.
 */
function sidebarItems(role: string | null, firstPersonId: string | null): SidebarItem[] {
  if (role === "guardian") {
    const p = firstPersonId;
    return [
      { label: "대시보드", href: "/dashboard", icon: <LayoutDashboard /> },
      { label: "생애주기 타임라인", href: p ? `/persons/${p}/timeline` : "/dashboard", icon: <TrendingUp /> },
      { label: "기록 관리", href: p ? `/persons/${p}/records` : "/dashboard", icon: <FolderOpen /> },
      { label: "권한 관리", href: p ? `/persons/${p}/permissions` : "/dashboard", icon: <Lock /> },
      { label: "접근 로그", href: p ? `/persons/${p}/access-logs` : "/dashboard", icon: <ScrollText /> },
      { label: "동의·권리 관리", href: "/settings/privacy", icon: <Settings /> },
    ];
  }
  if (role === "teacher") {
    return [
      { label: "홈", href: "/home", icon: <Home /> },
      { label: "IEP 작성", href: "/records/iep/new", icon: <PencilLine /> },
      { label: "IEP 점검", href: "/home", icon: <ClipboardList /> },
      { label: "관찰기록", href: "/records/observation/new", icon: <Eye /> },
      { label: "타임라인", href: "/timeline", icon: <BarChart3 /> },
      { label: "설정", href: "/settings", icon: <Settings /> },
    ];
  }
  if (role === "social_worker") {
    return [
      { label: "홈", href: "/home", icon: <Home /> },
      { label: "ISP 작성", href: "/records/isp/new", icon: <PencilLine /> },
      { label: "ISP 점검", href: "/home", icon: <BarChart3 /> },
      { label: "전환계획", href: "/records/transition/new", icon: <Compass /> },
      { label: "서비스 현황", href: "/records/service-status", icon: <ClipboardList /> },
      { label: "타임라인", href: "/timeline", icon: <FolderOpen /> },
      { label: "인수인계", href: "/handovers", icon: <ArrowLeftRight /> },
      { label: "설정", href: "/settings", icon: <Settings /> },
    ];
  }
  if (role === "therapist") {
    return [
      { label: "홈", href: "/home", icon: <Home /> },
      { label: "치료계획서", href: "/records/therapy-plan/new", icon: <ClipboardList /> },
      { label: "회기 일지", href: "/records/session/new", icon: <PencilLine /> },
      { label: "평가보고서", href: "/records/eval/new", icon: <BarChart3 /> },
      { label: "타임라인", href: "/timeline", icon: <Clock /> },
      { label: "설정", href: "/settings", icon: <Settings /> },
    ];
  }
  if (role === "supporter") {
    return [
      { label: "홈", href: "/home", icon: <Home /> },
      { label: "일지 작성", href: "/journals/new", icon: <PencilLine /> },
      { label: "일지 목록", href: "/journals", icon: <FileText /> },
      { label: "인수인계", href: "/handovers", icon: <ArrowLeftRight /> },
      { label: "인계 작성", href: "/handovers/new", icon: <Plus /> },
      { label: "설정", href: "/settings", icon: <Settings /> },
    ];
  }
  return [
    { label: "홈", href: "/home", icon: <Home /> },
    { label: "기록", href: "/records", icon: <FileText /> },
    { label: "설정", href: "/settings", icon: <Settings /> },
  ];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  let avatarUrl: string | null = null;
  let role: string | null = null;

  if (user) {
    const { data } = await supabase
      .from("users")
      .select("full_name, avatar_url, role, deactivated_at")
      .eq("id", user.id)
      .maybeSingle();
    fullName = data?.full_name ?? null;
    avatarUrl = data?.avatar_url ?? null;
    role = data?.role ?? null;
    // 재로그인 시 비활성화 해제(§settings/privacy "다시 로그인하면 해제됩니다" 안내와 대응).
    if (data?.deactivated_at) {
      await supabase.from("users").update({ deactivated_at: null }).eq("id", user.id);
    }
  }

  const unreadCount = user ? await getUnreadNotificationCount() : 0;
  const displayName = fullName ?? user?.email ?? null;
  const firstPersonId = role === "guardian" ? ((await getGuardianPersons())[0]?.id ?? null) : null;

  // 당사자 모드(§7-1): 사이드바 없이 중앙 정렬 단일 컬럼 폰 셸, 넉넉한 여백.
  if (role === "person") {
    return (
      <div className="flex flex-1 flex-col bg-primary-50/20">
        <GlobalHeader userName={displayName} userAvatarUrl={avatarUrl} notificationCount={unreadCount} />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">{children}</main>
        {process.env.NODE_ENV !== "production" && (
          <div className="mx-auto w-full max-w-lg rounded-t-(--br-lg) bg-primary-800">
            <AccountSwitcher currentEmail={user?.email ?? null} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      <GlobalHeader userName={displayName} userAvatarUrl={avatarUrl} notificationCount={unreadCount} />
      <div className="flex flex-1">
        <Sidebar
          items={sidebarItems(role, firstPersonId)}
          footer={
            process.env.NODE_ENV !== "production" ? (
              <AccountSwitcher currentEmail={user?.email ?? null} />
            ) : undefined
          }
        />
        <main className="flex flex-1 flex-col bg-[#fafaf9] px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
