import { getBipClients } from "@/app/(app)/records/bip/actions";
import { BipForm } from "@/components/teacher/BipForm";

/** T-17 행동중재계획(BIP) 작성. searchParams.personId로 특정 학생을 미리 선택할 수 있다. */
export default async function NewBipPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const students = await getBipClients();
  return <BipForm students={students} initialPersonId={personId} />;
}
