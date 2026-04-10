import { createClient } from "@/lib/supabase/server";
import { GoalsClient } from "./GoalsClient";

export default async function GoalsPage() {
  const supabase = await createClient();

  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("status", "active")
    .order("period_start", { ascending: false });

  // Pull current metrics to show progress
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [txns, shopifyOrders, adsData] = await Promise.all([
    supabase.from("transactions").select("type, amount").gte("date", monthStart),
    supabase.from("shopify_orders").select("total_amount, is_new_customer").gte("created_at", `${monthStart}T00:00:00`).eq("payment_status", "paid"),
    supabase.from("meta_ads_daily").select("spend, roas").gte("date", monthStart),
  ]);

  const mtdRevenue = (txns.data || []).filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const mtdExpenses = (txns.data || []).filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalOrders = (shopifyOrders.data || []).length;
  const newCusts = (shopifyOrders.data || []).filter(o => o.is_new_customer).length;
  const avgRoas = (adsData.data || []).length > 0
    ? (adsData.data || []).reduce((s, a) => s + (a.roas || 0), 0) / (adsData.data || []).length
    : 0;
  const totalAdSpend = (adsData.data || []).reduce((s, a) => s + a.spend, 0);
  const cac = newCusts > 0 ? totalAdSpend / newCusts : 0;

  const currentMetrics = {
    revenue: mtdRevenue,
    expenses: mtdExpenses,
    profit: mtdRevenue - mtdExpenses,
    orders: totalOrders,
    roas: Math.round(avgRoas * 100),
    cac: Math.round(cac),
    new_customers: newCusts,
  };

  return <GoalsClient goals={goals || []} currentMetrics={currentMetrics} />;
}
