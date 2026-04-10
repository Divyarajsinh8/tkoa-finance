import { createClient } from "@/lib/supabase/server";
import { StoreAnalyticsClient } from "./StoreAnalyticsClient";

export default async function StoreAnalyticsPage() {
  const supabase = await createClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [ordersRes, customersRes, payoutsRes] = await Promise.all([
    supabase
      .from("shopify_orders")
      .select("*")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false }),
    supabase
      .from("shopify_customers")
      .select("*")
      .order("last_order_date", { ascending: false })
      .limit(100),
    supabase
      .from("shopify_payouts")
      .select("*")
      .order("date", { ascending: false })
      .limit(20),
  ]);

  return (
    <StoreAnalyticsClient
      orders={ordersRes.data || []}
      customers={customersRes.data || []}
      payouts={payoutsRes.data || []}
    />
  );
}
