import { createClient } from "@/lib/supabase/server";
import { getPersonRecords } from "@/app/(app)/persons/[id]/records/actions";
import { getPersonBirthDate } from "@/app/(app)/home/actions";
import { computeLifeStage } from "@/lib/lifecycle";
import type { LifeStage } from "@/components/lifecycle/StageBadge";
import { PersonRecordsView } from "@/components/person/PersonRecordsView";

/**
 * P-10 기록 보기(당사자 본인) — docs/02-ia.md §3-10.
 * 로그인한 당사자 본인(person_id = auth.uid())의 기록을 시간순으로 보여준다. RLS가 본인 기록만
 * 반환하므로 personId에 자기 auth.uid()를 넘겨도 안전하다. 성인기·노년기 본인 확인 CTA는 뷰에서 분기한다.
 */
export default async function PersonRecordsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <p className="rounded-2xl bg-white p-5 text-person-base text-accent-pebble ring-1 ring-foreground/10">
        로그인이 필요합니다.
      </p>
    );
  }

  const [items, birthDate] = await Promise.all([getPersonRecords(user.id), getPersonBirthDate()]);
  const lifeStage: LifeStage = birthDate ? computeLifeStage(birthDate) : "child";

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-2xl font-extrabold text-foreground">내 기록 보기</h1>
      <p className="mt-1 text-person-base text-accent-pebble">
        나에 대해 남겨진 기록을 볼 수 있어요.
      </p>
      <div className="mt-6">
        <PersonRecordsView items={items} userId={user.id} lifeStage={lifeStage} />
      </div>
    </div>
  );
}
