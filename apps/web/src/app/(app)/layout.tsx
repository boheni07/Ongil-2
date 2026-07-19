import {
  Home,
  FileText,
  PencilLine,
  ArrowLeftRight,
  FolderOpen,
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
import { resolveCurrentPersonId } from "@/lib/current-person";
import { CurrentPersonProvider } from "@/components/guardian/CurrentPersonProvider";
import { PersonHeaderSelect } from "@/components/guardian/PersonHeaderSelect";
import { GuardianSidebar } from "@/components/guardian/GuardianSidebar";

/**
 * 2026-07-19: `/prototypes` 5개 역할 사이드바(web-guardian/teacher/social-worker/therapist/
 * supporter.html) 원문을 그대로 옮겼다 — 항목 라벨·순서·"설정"(보호자는 "동의·권리 관리")
 * 포함까지 프로토타입과 1:1. 특수교사 "IEP 점검"·사회복지사 "ISP 점검"은 특정 기록을 골라야
 * 하는 화면이라 목록 랜딩 페이지가 없어 홈(담당 학생/당사자 카드에서 개별 점검 진입)으로
 * 연결한다 — 다른 항목은 전부 프로토타입과 동일하게 독립 화면으로 바로 연결된다.
 *
 * 2026-07-20: 보호자는 헤더의 "당사자 선택" 드롭다운으로 사이드바가 참조하는 "현재 당사자"를
 * 바꿀 수 있어야 하는데(프로토타입 원문 동작), 이 함수는 요청 시점 1회만 실행되는 Server
 * Component라 그 전환을 반영할 수 없다 — 보호자는 `GuardianSidebar`(클라이언트, CurrentPersonProvider
 * 참조)로 분리했고 이 함수는 나머지 4역할+기본값만 담당한다.
 */
function sidebarItems(role: string | null): SidebarItem[] {
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

  const footer = process.env.NODE_ENV !== "production" ? <AccountSwitcher currentEmail={user?.email ?? null} /> : undefined;

  // 보호자: 헤더 콤보박스↔사이드바↔PersonSlider가 같은 "현재 당사자"를 공유해야 하므로
  // CurrentPersonProvider(클라이언트 Context)로 헤더+본문 전체를 감싼다. 초기값은 쿠키로
  // 복원(resolveCurrentPersonId)하고, 이후 전환은 페이지 이동 없이 Context로 즉시 반영된다.
  if (role === "guardian") {
    const persons = await getGuardianPersons();
    const currentPersonId = await resolveCurrentPersonId(persons.map((p) => p.id));
    return (
      <CurrentPersonProvider
        initialPersonId={currentPersonId}
        persons={persons.map((p) => ({ id: p.id, fullName: p.fullName, birthDate: p.birthDate }))}
      >
        <div className="flex flex-1 flex-col bg-white">
          <GlobalHeader
            userName={displayName}
            userAvatarUrl={avatarUrl}
            notificationCount={unreadCount}
            personSelector={<PersonHeaderSelect />}
          />
          <div className="flex flex-1">
            <GuardianSidebar footer={footer} />
            <main className="flex flex-1 flex-col bg-[#fafaf9] px-6 py-8">{children}</main>
          </div>
        </div>
      </CurrentPersonProvider>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      <GlobalHeader userName={displayName} userAvatarUrl={avatarUrl} notificationCount={unreadCount} />
      <div className="flex flex-1">
        <Sidebar items={sidebarItems(role)} footer={footer} />
        <main className="flex flex-1 flex-col bg-[#fafaf9] px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
