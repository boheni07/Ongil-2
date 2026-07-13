import Link from "next/link";
import { getTeacherStudents, getTimeline } from "@/app/(app)/records/iep/actions";
import { getSocialWorkerClients } from "@/app/(app)/records/isp/actions";
import { getTherapistClients } from "@/app/(app)/records/therapy/actions";
import { EduTimeline } from "@/components/teacher/EduTimeline";
import { createClient } from "@/lib/supabase/server";

/**
 * T-20/W-20/TH-20 공용 타임라인. searchParams.personId 없으면 담당 대상자 선택 유도 화면을 보여준다.
 * role별로 담당 대상자 목록 조회 함수와 문구("학생"/"당사자"/"아동")만 다르고, 나머지는 동일하다
 * (getTimeline/EduTimeline은 role 무관 범용이라 그대로 재사용).
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

  const clients =
    role === "social_worker"
      ? (await getSocialWorkerClients()).map((c) => ({ personId: c.personId, fullName: c.fullName }))
      : role === "therapist"
        ? (await getTherapistClients()).map((c) => ({ personId: c.personId, fullName: c.fullName }))
        : (await getTeacherStudents()).map((s) => ({ personId: s.personId, fullName: s.fullName }));

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
          <ul className="mt-6 flex flex-col gap-2">
            {clients.map((c) => (
              <li key={c.personId}>
                <Link
                  href={`/timeline?personId=${c.personId}`}
                  className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
                >
                  <span className="text-body font-semibold text-foreground">{c.fullName}</span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const [items, client] = [
    await getTimeline(personId),
    clients.find((c) => c.personId === personId) ?? null,
  ];

  return <EduTimeline items={items} personName={client?.fullName ?? personLabel} />;
}
