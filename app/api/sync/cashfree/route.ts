import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllCashfreeOrders,
  fetchCashfreePayments,
  fetchCashfreeSettlements,
  paymentToDbRow,
} from "@/lib/cashfree";

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

  if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Cashfree credentials not configured" }, { status: 400 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const fromDate = sevenDaysAgo.toISOString().split("T")[0];
    const toDate = now.toISOString().split("T")[0];

    // Fetch orders and settlements in parallel
    const [orders, settlements] = await Promise.all([
      fetchAllCashfreeOrders(fromDate, toDate),
      fetchCashfreeSettlements(fromDate, toDate),
    ]);

    // Build settlement map by order_id
    const settlementMap: Record<string, (typeof settlements)[0]> = {};
    for (const s of settlements) {
      settlementMap[s.order_id] = s;
    }

    let upserted = 0;

    // Process orders in batches of 10 (each needs a payments API call)
    const rows = [];
    for (let i = 0; i < orders.length; i += 10) {
      const batch = orders.slice(i, i + 10);
      const paymentResults = await Promise.all(
        batch.map(o => fetchCashfreePayments(o.order_id))
      );

      for (let j = 0; j < batch.length; j++) {
        const order = batch[j];
        const payments = paymentResults[j];
        const successPayment = payments.find(p => p.payment_status === "SUCCESS") || payments[0];
        const settlement = settlementMap[order.order_id];

        rows.push(paymentToDbRow(order, successPayment, settlement));
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("cashfree_transactions")
        .upsert(rows, { onConflict: "cf_order_id" });

      if (error) throw new Error(`Cashfree upsert failed: ${error.message}`);
      upserted = rows.length;
    }

    await supabase.from("sync_log").insert({
      source: "cashfree",
      status: "success",
      records_synced: upserted,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, records: upserted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("sync_log").insert({
      source: "cashfree",
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
