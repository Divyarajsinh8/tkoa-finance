import { createClient } from "@/lib/supabase/server";
import { InvoicesClient } from "./InvoicesClient";

export default async function InvoicesPage() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .order("date", { ascending: false });

  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .single();

  return <InvoicesClient invoices={invoices ?? []} role={userProfile?.role ?? "viewer"} />;
}
