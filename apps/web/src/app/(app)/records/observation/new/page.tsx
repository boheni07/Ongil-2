import { getTeacherStudents } from "@/app/(app)/records/iep/actions";
import { ObservationForm } from "@/components/teacher/ObservationForm";

/** T-16 관찰기록 작성. searchParams.personId로 특정 학생을 미리 선택할 수 있다(T-14 연결 진입). */
export default async function NewObservationPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const students = await getTeacherStudents();
  return <ObservationForm students={students} initialPersonId={personId} />;
}
