import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchGA4DailyData } from "@/lib/ga4";

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

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({ error: "GA4 credentials not configured" }, { status: 400 });
  }

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dateStop = yesterday.toISOString().split("T")[0];
    const dateStart = sevenDaysAgo.toISOString().split("T")[0];

    const rows = await fetchGA4DailyData(propertyId, dateStart, dateStop);
    let upserted = 0;

    if (rows.length > 0) {
      const { error } = await supabase
        .from("ga4_daily")
        .upsert(rows, { onConflict: "date,property" });

      if (error) throw new Error(`GA4 upsert failed: ${error.message}`);
      upserted = rows.length;
    }

    await supabase.from("sync_log").insert({
      source: "ga4",
      status: "success",
      records_synced: upserted,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, records: upserted, dateRange: { dateStart, dateStop } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("sync_log").insert({
      source: "ga4",
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
