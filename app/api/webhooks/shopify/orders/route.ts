import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { orderToDbRow, getShopifyStores } from "@/lib/shopify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyShopifyWebhook(req: Request): Promise<{ valid: boolean; body: string }> {
  const body = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret || !hmacHeader) return { valid: false, body };

  const hash = createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");

  return { valid: hash === hmacHeader, body };
}

export async function POST(req: Request) {
  const { valid, body } = await verifyShopifyWebhook(req);
  if (!valid && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    const order = JSON.parse(body);
    const shopDomain = req.headers.get("x-shopify-shop-domain") || "";

    // Find matching store name
    const stores = getShopifyStores();
    const store = stores.find(s => shopDomain.includes(s.url.split(".")[0]));
    const storeName = store?.name || shopDomain;

    const row = orderToDbRow(order, storeName);

    const { error } = await supabase
      .from("shopify_orders")
      .upsert(row, { onConflict: "shopify_order_id" });

    if (error) throw error;

    // Sync to transactions if paid
    if (order.financial_status === "paid") {
      await supabase
        .from("transactions")
        .upsert({
          txn_id: `SHOPIFY-${storeName}-${order.id}`,
          type: "income",
          category: "Shopify Sales",
          sub_category: storeName,
          vendor: storeName,
          description: `Order #${order.order_number}`.slice(0, 255),
          amount: Math.round(parseFloat(order.total_price) * 100),
          date: order.created_at.split("T")[0],
          status: "received",
          payment_method: "shopify_payments",
        }, { onConflict: "txn_id" });
    }

    // Create in-app notification
    await supabase.from("ai_alerts").insert({
      severity: "info",
      category: "revenue",
      title: `New order — ${storeName}`,
      description: `Order #${order.order_number} for ₹${(parseFloat(order.total_price)).toFixed(0)} from ${order.email || "customer"}`,
      data: { order_id: order.id, amount: order.total_price, store: storeName },
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Shopify order webhook error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
