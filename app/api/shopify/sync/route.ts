import { NextRequest, NextResponse } from "next/server";
import { fetchAllShopifyOrders, getShopifyStores } from "@/lib/shopify";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const { sinceDate } = await request.json().catch(() => ({}));
    const stores = getShopifyStores();
    if (stores.length === 0) return NextResponse.json({ error: "No Shopify stores configured" }, { status: 400 });

    const orders = await fetchAllShopifyOrders(stores[0], sinceDate);

    let synced = 0;
    for (const order of orders) {
      const amount = Math.round(parseFloat(order.total_price) * 100);
      const txnId = `TXN-SHOPIFY-${order.id}`;

      const { error } = await supabase.from("transactions").upsert({
        txn_id: txnId,
        type: "income",
        category: "Shopify Revenue",
        vendor: order.email || "Shopify Customer",
        amount,
        gst_amount: 0,
        date: order.created_at.split("T")[0],
        status: order.financial_status === "paid" ? "received" : "pending",
        payment_method: "shopify_payments",
        created_by: user.id,
      }, { onConflict: "txn_id" });

      if (!error) synced++;
    }

    return NextResponse.json({ synced, total: orders.length });
  } catch (error) {
    console.error("Shopify sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
