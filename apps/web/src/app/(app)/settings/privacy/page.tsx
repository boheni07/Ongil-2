import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyConsentStatus, getReacquisitionTargets } from "./actions";
import { PrivacySettingsClient } from "./PrivacySettingsClient";

/**
 * G-65(보호자) / P-23(당사자) 공용 동의·권리 관리 — docs/02-ia.md상 두 화면 모두 /settings/privacy.
 * role에 따라 헤딩 문구만 분기하고, 재취득 섹션은 getReacquisitionTargets()가 비어있지 않을 때만
 * 노출한다(셀프가입 성인 person 케이스에서만 값이 있으며, 그 외 빈 배열이 정상 — Flow-SYS-05 연결부).
 */
export default async function PrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = userRow?.role ?? null;

  const [consents, reacquisitionTargets] = await Promise.all([
    getMyConsentStatus(),
    getReacquisitionTargets(),
  ]);

  return (
    <PrivacySettingsClient
      role={role}
      consents={consents}
      reacquisitionTargets={reacquisitionTargets}
    />
  );
}
