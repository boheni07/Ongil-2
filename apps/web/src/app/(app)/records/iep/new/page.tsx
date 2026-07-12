import { getTeacherStudents } from "@/app/(app)/records/iep/actions";
import { IepWizard } from "@/components/teacher/IepWizard";

/** T-13 IEP 작성. searchParams.personId로 특정 학생을 미리 선택할 수 있다. */
export default async function NewIepPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const students = await getTeacherStudents();
  return <IepWizard students={students} initialPersonId={personId} />;
}
