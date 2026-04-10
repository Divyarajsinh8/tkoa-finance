import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getShopifyStores,
  fetchAllShopifyOrders,
  fetchShopifyCustomers,
  fetchShopifyPayouts,
  orderToDbRow,
  customerToDbRow,
  payoutToDbRow,
} from "@/lib/shopify";

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

  const stores = getShopifyStores();
  if (stores.length === 0) {
    return NextResponse.json({ error: "No Shopify stores configured" }, { status: 400 });
  }

  const results: Record<string, { orders: number; customers: number; payouts: number; error?: string }> = {};

  for (const store of stores) {
    try {
      // Get last sync date from sync_log
      const { data: lastSync } = await supabase
        .from("sync_log")
        .select("completed_at")
        .eq("source", `shopify_${store.name}`)
        .eq("status", "success")
        .order("completed_at", { ascending: false })
        .limit(1)
        .single();

      // Default: sync last 7 days to catch any missed orders
      const sinceDate = lastSync?.completed_at
        ? new Date(new Date(lastSync.completed_at).getTime() - 2 * 60 * 60 * 1000).toISOString() // 2hr overlap
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Sync orders
      const orders = await fetchAllShopifyOrders(store, sinceDate);
      let ordersUpserted = 0;

      if (orders.length > 0) {
        const rows = orders.map(o => orderToDbRow(o, store.name));
        const { error } = await supabase
          .from("shopify_orders")
          .upsert(rows, { onConflict: "shopify_order_id" });

        if (error) throw new Error(`Orders upsert failed: ${error.message}`);
        ordersUpserted = rows.length;

        // Also sync to transactions table for unified view
        const txnRows = orders
          .filter(o => o.financial_status === "paid")
          .map(o => ({
            txn_id: `SHOPIFY-${store.name}-${o.id}`,
            type: "income" as const,
            category: "Shopify Sales",
            sub_category: store.name,
            vendor: store.name,
            description: `Order ${o.order_number || o.id} — ${o.line_items?.map(l => l.title).join(", ") || ""}`.slice(0, 255),
            amount: Math.round(parseFloat(o.total_price) * 100),
            date: o.created_at.split("T")[0],
            status: "received" as const,
            payment_method: "shopify_payments" as const,
            notes: `Source: Shopify ${store.name}`,
          }));

        if (txnRows.length > 0) {
          await supabase
            .from("transactions")
            .upsert(txnRows, { onConflict: "txn_id" });
        }
      }

      // Sync customers
      const customers = await fetchShopifyCustomers(store, sinceDate);
      let customersUpserted = 0;

      if (customers.length > 0) {
        const custRows = customers.map(c => customerToDbRow(c, store.name));
        const { error } = await supabase
          .from("shopify_customers")
          .upsert(custRows, { onConflict: "shopify_customer_id" });

        if (error) throw new Error(`Customers upsert failed: ${error.message}`);
        customersUpserted = custRows.length;
      }

      // Sync payouts
      const payouts = await fetchShopifyPayouts(store, sinceDate.split("T")[0]);
      let payoutsUpserted = 0;

      if (payouts.length > 0) {
        const payoutRows = payouts.map(p => payoutToDbRow(p, store.name));
        const { error } = await supabase
          .from("shopify_payouts")
          .upsert(payoutRows, { onConflict: "payout_id" });

        if (error) throw new Error(`Payouts upsert failed: ${error.message}`);
        payoutsUpserted = payoutRows.length;
      }

      // Log success
      await supabase.from("sync_log").insert({
        source: `shopify_${store.name}`,
        status: "success",
        records_synced: ordersUpserted + customersUpserted + payoutsUpserted,
        completed_at: new Date().toISOString(),
      });

      results[store.name] = {
        orders: ordersUpserted,
        customers: customersUpserted,
        payouts: payoutsUpserted,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase.from("sync_log").insert({
        source: `shopify_${store.name}`,
        status: "error",
        records_synced: 0,
        error_message: msg,
        completed_at: new Date().toISOString(),
      });
      results[store.name] = { orders: 0, customers: 0, payouts: 0, error: msg };
    }
  }

  return NextResponse.json({ success: true, results });
}

// Allow GET for Vercel cron
export async function GET(req: Request) {
  return POST(req);
}
