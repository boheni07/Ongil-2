import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PersonRegisterWizard } from "@/components/guardian/PersonRegisterWizard";

/** Flow-G-01 당사자 등록(단일 화면). 보호자 전용. */
export default async function NewPersonPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.user_metadata?.role as string | undefined) ?? null;
  if (role !== "guardian") redirect("/home");

  return <PersonRegisterWizard />;
}
