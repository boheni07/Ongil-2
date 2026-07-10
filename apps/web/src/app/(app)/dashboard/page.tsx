import Link from "next/link";
import { getGuardianPersons } from "./actions";
import { PersonSlider } from "@/components/guardian/PersonSlider";
import { Button } from "@/components/ui/button";

/** G-01 보호자 대시보드 — 당사자 슬라이더 + 요약 카드 + 당사자 추가. */
export default async function DashboardPage() {
  const persons = await getGuardianPersons();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-1 font-extrabold text-foreground">대시보드</h1>
          <p className="mt-1 text-body text-muted-foreground">피보호자 현황을 한눈에 확인하세요.</p>
        </div>
        <Button render={<Link href="/dashboard/persons/new" />} className="h-11 font-bold">
          + 당사자 추가
        </Button>
      </div>

      <div className="mt-6">
        {persons.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center ring-1 ring-foreground/10">
            <p className="text-4xl" aria-hidden="true">
              👪
            </p>
            <h2 className="mt-3 text-headline-3 font-bold text-foreground">등록된 당사자가 없습니다</h2>
            <p className="mt-2 text-body text-muted-foreground">
              먼저 돌보는 당사자를 등록하면 기록과 권한을 관리할 수 있습니다.
            </p>
            <Button render={<Link href="/dashboard/persons/new" />} className="mt-5 h-11 font-bold">
              당사자 등록하기
            </Button>
          </div>
        ) : (
          <PersonSlider persons={persons} />
        )}
      </div>
    </div>
  );
}
