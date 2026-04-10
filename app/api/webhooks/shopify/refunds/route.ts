import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

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
    const refund = JSON.parse(body);
    const orderId = refund.order_id?.toString();
    const shopDomain = req.headers.get("x-shopify-shop-domain") || "";

    // Calculate refund amount
    const refundAmount = refund.transactions
      ?.filter((t: { kind: string }) => t.kind === "refund")
      ?.reduce((sum: number, t: { amount: string }) => sum + Math.round(parseFloat(t.amount) * 100), 0) || 0;

    if (refundAmount > 0 && orderId) {
      // Update the original order payment status
      await supabase
        .from("shopify_orders")
        .update({ payment_status: "refunded" })
        .eq("shopify_order_id", orderId);

      // Fire a critical alert for refunds
      await supabase.from("ai_alerts").insert({
        severity: "warning",
        category: "revenue",
        title: `Refund issued — ₹${(refundAmount / 100).toFixed(0)}`,
        description: `Refund of ₹${(refundAmount / 100).toFixed(0)} processed for order ${orderId} on ${shopDomain}`,
        data: { order_id: orderId, refund_amount: refundAmount, shop: shopDomain },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Shopify refund webhook error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
