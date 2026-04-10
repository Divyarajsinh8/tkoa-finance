import { createClient } from "@/lib/supabase/server";
import { AdsClient } from "./AdsClient";

export default async function AdsPage() {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: adsData } = await supabase
    .from("meta_ads_daily")
    .select("*")
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: false });

  const { data: syncLog } = await supabase
    .from("sync_log")
    .select("completed_at, status, records_synced")
    .eq("source", "meta_ads")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  return <AdsClient ads={adsData || []} lastSync={syncLog} />;
}
