import Link from "next/link";
import type { EmergencyInfoInput } from "@ongil/validation";
import { getTeacherStudents, getTimeline } from "@/app/(app)/records/iep/actions";
import { getSocialWorkerClients } from "@/app/(app)/records/isp/actions";
import { getTherapistClients } from "@/app/(app)/records/therapy/actions";
import { TimelineView } from "@/components/timeline/TimelineView";
import { createClient } from "@/lib/supabase/server";
import { computeAge } from "@/lib/lifecycle";
import { StageBadge, type LifeStage } from "@/components/lifecycle/StageBadge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

/**
 * T-20/W-20/TH-20 공용 타임라인. searchParams.personId 없으면 담당 대상자 선택 유도 화면을 보여준다.
 * role별로 담당 대상자 목록 조회 함수와 문구("학생"/"당사자"/"아동")만 다르고, 나머지는 동일하다
 * (getTimeline/TimelineView는 role 무관 범용이라 그대로 재사용).
 *
 * 응급 대응 정보(PinnedCard)는 원래 보호자 전용(G-10)으로 한정돼 있었으나, 프로토타입
 * 대조 결과 특수교사·사회복지사·치료사 화면에도 상단 고정 카드가 있어야 함을 확인해 확장했다
 * (2026-07-19). persons_select RLS는 permissions 보유자에게 이미 열려 있어(2026-07-17
 * p3_persons_select_permission_holders) 추가 정책 변경 없이 조회만 하면 된다.
 */
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    role = data?.role ?? null;
  }
  const personLabel =
    role === "social_worker" ? "당사자" : role === "therapist" ? "아동" : "학생";

  const clients: { personId: string; fullName: string; birthDate: string; avatarUrl: string | null; lifeStage: LifeStage }[] =
    role === "social_worker"
      ? (await getSocialWorkerClients()).map((c) => ({
          personId: c.personId,
          fullName: c.fullName,
          birthDate: c.birthDate,
          avatarUrl: c.avatarUrl,
          lifeStage: c.lifeStage,
        }))
      : role === "therapist"
        ? (await getTherapistClients()).map((c) => ({
            personId: c.personId,
            fullName: c.fullName,
            birthDate: c.birthDate,
            avatarUrl: c.avatarUrl,
            lifeStage: c.lifeStage,
          }))
        : (await getTeacherStudents()).map((s) => ({
            personId: s.personId,
            fullName: s.fullName,
            birthDate: s.birthDate,
            avatarUrl: s.avatarUrl,
            lifeStage: s.lifeStage,
          }));

  if (!personId) {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className="text-headline-2 font-extrabold text-foreground">타임라인</h1>
        <p className="mt-1 text-body text-muted-foreground">
          타임라인을 확인할 {personLabel}를 선택하세요.
        </p>
        {clients.length === 0 ? (
          <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
            담당 {personLabel}가 없습니다.
          </p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <Link
                key={c.personId}
                href={`/timeline?personId=${c.personId}`}
                className="rounded-xl border-2 border-border bg-white p-4 text-left shadow-md transition-colors hover:border-primary-400"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="lg" className="bg-primary-50">
                    {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt="" /> : null}
                    <AvatarFallback aria-hidden="true" className="bg-primary-50 text-2xl">
                      🧑
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="truncate text-body font-bold text-foreground">{c.fullName}</h3>
                    <p className="text-caption text-muted-foreground">만 {computeAge(c.birthDate)}세</p>
                    <div className="mt-1">
                      <StageBadge lifeStage={c.lifeStage} className="min-h-6 pr-2 text-[11px]" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const [items, client, emergencyRow] = [
    await getTimeline(personId),
    clients.find((c) => c.personId === personId) ?? null,
    (await supabase.from("persons").select("emergency_info").eq("id", personId).maybeSingle())
      .data,
  ];
  const emergencyInfo = (emergencyRow?.emergency_info ?? null) as EmergencyInfoInput | null;

  return (
    <TimelineView
      items={items}
      personName={client?.fullName ?? personLabel}
      birthDate={client?.birthDate}
      emergencyInfo={emergencyInfo}
    />
  );
}
