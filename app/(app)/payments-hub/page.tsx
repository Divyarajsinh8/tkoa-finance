import { createClient } from "@/lib/supabase/server";
import { PaymentsHubClient } from "./PaymentsHubClient";

export default async function PaymentsHubPage() {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [cfRes, payoutsRes] = await Promise.all([
    supabase
      .from("cashfree_transactions")
      .select("*")
      .gte("payment_time", thirtyDaysAgo)
      .order("payment_time", { ascending: false }),
    supabase
      .from("shopify_payouts")
      .select("*")
      .order("date", { ascending: false })
      .limit(20),
  ]);

  return (
    <PaymentsHubClient
      transactions={cfRes.data || []}
      payouts={payoutsRes.data || []}
    />
  );
}
