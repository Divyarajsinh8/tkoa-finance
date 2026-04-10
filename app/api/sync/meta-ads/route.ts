import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMetaInsights, insightToDbRow, getDateRange } from "@/lib/meta-ads";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyCronSecret(req: Request): boolean {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET || process.env.NODE_ENV === "development";
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.META_ADS_ACCESS_TOKEN || !process.env.META_ADS_ACCOUNT_ID) {
    return NextResponse.json({ error: "Meta Ads credentials not configured" }, { status: 400 });
  }

  try {
    // Sync last 7 days (with overlap to catch delayed attribution)
    const { dateStart, dateStop } = getDateRange(7);

    const insights = await fetchMetaInsights(dateStart, dateStop, "ad");

    let upserted = 0;
    if (insights.length > 0) {
      const rows = insights.map(insightToDbRow);

      // Batch upsert in chunks of 100
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabase
          .from("meta_ads_daily")
          .upsert(chunk, { onConflict: "date,campaign_id,adset_id,ad_id" });

        if (error) throw new Error(`Meta ads upsert failed: ${error.message}`);
        upserted += chunk.length;
      }
    }

    await supabase.from("sync_log").insert({
      source: "meta_ads",
      status: "success",
      records_synced: upserted,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, records: upserted, dateRange: { dateStart, dateStop } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("sync_log").insert({
      source: "meta_ads",
      status: "error",
      records_synced: 0,
      error_message: msg,
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
