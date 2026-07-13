import { createClient } from "@/lib/supabase/server";
import { PersonHome } from "@/components/person/PersonHome";
import { SupporterHome } from "@/components/supporter/SupporterHome";
import { TeacherHome } from "@/components/teacher/TeacherHome";
import { SocialWorkerHome } from "@/components/social-worker/SocialWorkerHome";
import { TherapistHome } from "@/components/therapist/TherapistHome";

/**
 * /home — 역할별 분기(docs/02-ia.md §5). person이면 P-01, supporter면 S-01을 렌더한다.
 * 나머지 역할은 아직 전용 홈이 없어 안내 문구만 보여준다.
 */
export default async function HomePage() {
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

  if (role === "person") return <PersonHome userName={fullName} />;
  if (role === "supporter") return <SupporterHome userName={fullName} />;
  if (role === "teacher") return <TeacherHome userName={fullName} />;
  if (role === "social_worker") return <SocialWorkerHome userName={fullName} />;
  if (role === "therapist") return <TherapistHome userName={fullName} />;

  return (
    <div>
      <h1 className="text-headline-2 font-semibold text-foreground">홈</h1>
      <p className="mt-2 text-body text-muted-foreground">
        이 역할의 홈 화면은 다음 단계에서 제공됩니다.
      </p>
    </div>
  );
}
