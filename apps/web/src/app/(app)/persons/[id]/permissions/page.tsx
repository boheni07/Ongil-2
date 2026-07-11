import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianPersons } from "@/app/(app)/dashboard/actions";
import { getPermissionMatrix } from "./actions";
import { computeLifeStage } from "@/lib/lifecycle";
import { PermissionMatrix } from "@/components/guardian/PermissionMatrix";
import { Button } from "@/components/ui/button";

/**
 * G-30 권한 매트릭스 — 행=협력자, 열=6도메인. 셀 클릭 시 회색→읽기→작성→편집 순환.
 * docs/02-ia.md §3-9(성년기 동의 이관 배너), 프로토타입 web-guardian.html 569~598줄.
 */
export default async function PermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const persons = await getGuardianPersons();
  const person = persons.find((p) => p.id === id);
  if (!person) notFound();

  const rows = await getPermissionMatrix(id);
  const isAdult = computeLifeStage(person.birthDate) === "adult";

  return (
    <div className="max-w-4xl">
      <h1 className="text-headline-1 font-extrabold text-foreground">권한 관리</h1>
      <p className="mt-1 text-body text-muted-foreground">
        {person.fullName} · 셀을 클릭하면 회색 → 읽기 → 작성 → 편집 순으로 순환합니다.
      </p>

      {isAdult && (
        <div
          role="note"
          className="mt-5 rounded-(--br-md) bg-domain-dai-bg p-4 text-body text-domain-dai-text ring-1 ring-domain-dai-accent/30"
        >
          <p className="font-bold">성년기 진입 · 본인 동의 이관 완료</p>
          <p className="mt-1 leading-relaxed text-foreground/80">
            {person.fullName} 님은 성년기에 진입하여 기록·동의의 주체가 본인으로 이관되었습니다. 권한의 부여·회수는
            당사자 본인의 동의를 전제로 신중하게 관리해주세요.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-accent-stone">
        <Legend color="#F3F4F6" text="#6B7280" label="없음" />
        <Legend color="#3B82F6" label="읽기(read)" />
        <Legend color="#10B981" label="작성(write)" />
        <Legend color="#F59E0B" label="편집(edit)" />
      </div>

      <div className="mt-4">
        <PermissionMatrix personId={id} initialRows={rows} />
      </div>

      <div className="mt-5">
        <Button
          render={<Link href={`/persons/${id}/permissions/grant`} />}
          className="h-11 bg-accent-amber font-bold text-accent-stone hover:bg-[#f5bd5e]"
        >
          ＋ 새 권한 부여
        </Button>
      </div>
    </div>
  );
}

function Legend({ color, text, label }: { color: string; text?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block size-3.5 rounded-[3px] ring-1 ring-black/5"
        style={{ backgroundColor: color, borderColor: text }}
      />
      {label}
    </span>
  );
}
