import { createClient } from "@/lib/supabase/server";
import { TrafficClient } from "./TrafficClient";

export default async function TrafficPage() {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: ga4Data } = await supabase
    .from("ga4_daily")
    .select("*")
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: false });

  return <TrafficClient data={ga4Data || []} />;
}
