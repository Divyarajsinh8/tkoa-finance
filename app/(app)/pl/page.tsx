import { createClient } from "@/lib/supabase/server";
import { PLClient } from "./PLClient";

export default async function PLPage() {
  const supabase = await createClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const since = sixMonthsAgo.toISOString().split("T")[0];

  const [
    { data: transactions },
    { data: shopifyOrders },
    { data: metaAds },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, category, amount, gst_amount, date, status")
      .gte("date", since)
      .in("status", ["paid", "received"]),
    supabase
      .from("shopify_orders")
      .select("total_amount, created_at, payment_status, store")
      .gte("created_at", since)
      .eq("payment_status", "paid"),
    supabase
      .from("meta_ads_daily")
      .select("date, spend, campaign_name")
      .gte("date", since),
  ]);

  return (
    <PLClient
      transactions={transactions ?? []}
      shopifyOrders={shopifyOrders ?? []}
      metaAds={metaAds ?? []}
    />
  );
}
