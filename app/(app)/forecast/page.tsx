import { createClient } from "@/lib/supabase/server";
import { ForecastClient } from "./ForecastClient";

export default async function ForecastPage() {
  const supabase = await createClient();

  const { data: forecasts } = await supabase
    .from("ai_forecasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(15);

  // Get 6 months historical for chart
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: history } = await supabase
    .from("shopify_orders")
    .select("total_amount, created_at")
    .gte("created_at", sixMonthsAgo.toISOString())
    .eq("payment_status", "paid");

  return <ForecastClient forecasts={forecasts || []} history={history || []} />;
}
