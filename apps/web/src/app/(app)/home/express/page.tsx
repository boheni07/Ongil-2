import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpressWizard } from "@/components/person/ExpressWizard";

/** P-02 자기표현 4단계 위저드. 당사자 전용. */
export default async function ExpressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.user_metadata?.role as string | undefined) ?? null;
  if (role !== "person") redirect("/home");

  return <ExpressWizard />;
}
