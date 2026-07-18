import { getLegClients } from "@/app/(app)/records/leg/actions";
import { LegRecordsBoard } from "@/components/social-worker/LegRecordsBoard";

/** W-21 법률·권리(LEG) 기록 목록·진입 허브. searchParams.personId로 특정 당사자를 미리 선택할 수 있다. */
export default async function LegRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ personId?: string }>;
}) {
  const { personId } = await searchParams;
  const clients = await getLegClients();
  return <LegRecordsBoard clients={clients} initialPersonId={personId} />;
}
