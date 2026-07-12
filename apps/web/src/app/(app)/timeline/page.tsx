import Link from "next/link";
import { getTeacherStudents, getTimeline } from "@/app/(app)/records/iep/actions";
import { EduTimeline } from "@/components/teacher/EduTimeline";

/**
 * T-20 교육 타임라인. searchParams.personId 없으면 담당 학생 선택 유도 화면을 보여준다.
 * personName은 담당 학생 목록에서 파생한다(getTimeline은 이름을 반환하지 않음).
 */
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const students = await getTeacherStudents();

  if (!personId) {
    return (
      <div className="flex flex-1 flex-col">
        <h1 className="text-headline-2 font-extrabold text-foreground">타임라인</h1>
        <p className="mt-1 text-body text-muted-foreground">
          타임라인을 확인할 학생을 선택하세요.
        </p>
        {students.length === 0 ? (
          <p className="mt-6 rounded-xl bg-white p-5 text-body text-muted-foreground ring-1 ring-foreground/10">
            담당 학생이 없습니다.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-2">
            {students.map((s) => (
              <li key={s.personId}>
                <Link
                  href={`/timeline?personId=${s.personId}`}
                  className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-primary-50"
                >
                  <span className="text-body font-semibold text-foreground">{s.fullName}</span>
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

  const [items, student] = [
    await getTimeline(personId),
    students.find((s) => s.personId === personId) ?? null,
  ];

  return <EduTimeline items={items} personName={student?.fullName ?? "학생"} />;
}
