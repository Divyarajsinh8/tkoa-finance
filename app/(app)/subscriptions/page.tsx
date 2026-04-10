import { createClient } from "@/lib/supabase/server";
import { SubscriptionsClient } from "./SubscriptionsClient";

export default async function SubscriptionsPage() {
  const supabase = await createClient();

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("*")
    .order("next_due_date", { ascending: true });

  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .single();

  return <SubscriptionsClient subscriptions={subscriptions ?? []} role={userProfile?.role ?? "viewer"} />;
}
