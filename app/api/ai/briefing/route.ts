import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function verifyCronSecret(req: Request): boolean {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET || process.env.NODE_ENV === "development";
}

async function gatherSnapshot() {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yStr = yesterday.toISOString().split("T")[0];
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  // Yesterday's Shopify orders
  const { data: ydayOrders } = await supabase
    .from("shopify_orders")
    .select("total_amount, store, payment_status")
    .gte("created_at", `${yStr}T00:00:00`)
    .lt("created_at", `${today.toISOString().split("T")[0]}T00:00:00`);

  // Yesterday's Meta Ads spend
  const { data: ydayAds } = await supabase
    .from("meta_ads_daily")
    .select("spend, conversions, conversion_value, roas, campaign_name")
    .eq("date", yStr);

  // Month-to-date transactions
  const { data: mtdTxns } = await supabase
    .from("transactions")
    .select("type, amount, category")
    .gte("date", monthStart);

  // Upcoming subscriptions (next 7 days)
  const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: dueSubs } = await supabase
    .from("subscriptions")
    .select("name, cost, next_due_date")
    .eq("status", "active")
    .lte("next_due_date", next7)
    .gte("next_due_date", today.toISOString().split("T")[0]);

  // Unread AI alerts
  const { data: alerts } = await supabase
    .from("ai_alerts")
    .select("severity, title, description")
    .eq("is_read", false)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(5);

  // Compute summary stats
  const ydayRevenue = (ydayOrders || [])
    .filter(o => o.payment_status === "paid")
    .reduce((s, o) => s + o.total_amount, 0) / 100;

  const ydayOrders_ = (ydayOrders || []).filter(o => o.payment_status === "paid").length;

  const totalAdSpend = (ydayAds || []).reduce((s, a) => s + a.spend, 0) / 100;
  const avgRoas = ydayAds?.length
    ? (ydayAds.reduce((s, a) => s + (a.roas || 0), 0) / ydayAds.length).toFixed(2)
    : "N/A";

  const mtdRevenue = (mtdTxns || [])
    .filter(t => t.type === "income")
    .reduce((s, t) => s + t.amount, 0) / 100;
  const mtdExpenses = (mtdTxns || [])
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0) / 100;

  return {
    date: yStr,
    yesterday: {
      revenue: ydayRevenue,
      orders: ydayOrders_,
      adSpend: totalAdSpend,
      roas: avgRoas,
    },
    monthToDate: {
      revenue: mtdRevenue,
      expenses: mtdExpenses,
      profit: mtdRevenue - mtdExpenses,
    },
    upcomingSubscriptions: (dueSubs || []).map(s => ({
      name: s.name,
      amount: s.cost / 100,
      dueDate: s.next_due_date,
    })),
    activeAlerts: (alerts || []).map(a => ({
      severity: a.severity,
      title: a.title,
      summary: a.description,
    })),
  };
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Check if already generated today
  const { data: existing } = await supabase
    .from("ai_briefings")
    .select("id")
    .eq("date", today)
    .single();

  if (existing) {
    return NextResponse.json({ message: "Briefing already generated today" });
  }

  const snapshot = await gatherSnapshot();

  const prompt = `You are the AI financial advisor for TKOA Private Limited, an Indian e-commerce company selling automation templates and courses via Shopify.

Generate a concise, actionable morning briefing for Raj (the founder). Today is ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

DATA:
${JSON.stringify(snapshot, null, 2)}

FORMAT your briefing as:
1. **Good morning, Raj** — one sentence greeting with day/date
2. **Yesterday at a Glance** — revenue, orders, ad spend, ROAS in 2-3 bullet points
3. **Month-to-Date** — revenue, expenses, profit so far
4. **Today's Priorities** — 2-3 specific action items based on the data
5. **One Insight** — one sharp observation or recommendation backed by numbers

Keep it under 250 words. Be direct, data-driven, and conversational. Use Indian number formatting (₹ with lakhs/crores).`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";

  // Save briefing
  const { data: briefing } = await supabase
    .from("ai_briefings")
    .insert({ date: today, content, data_snapshot: snapshot })
    .select()
    .single();

  // Send email if Resend configured
  if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TKOA Finance <briefing@tkoa.in>",
          to: process.env.NOTIFICATION_EMAIL,
          subject: `Morning Briefing — ${new Date().toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" })}`,
          text: content,
          html: `<pre style="font-family: sans-serif; white-space: pre-wrap; max-width: 600px; margin: 0 auto; padding: 24px;">${content}</pre>
<p style="color: #666; font-size: 12px; text-align: center; margin-top: 24px;">
  <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">View Dashboard</a> · TKOA Finance
</p>`,
        }),
      });

      await supabase
        .from("ai_briefings")
        .update({ sent_at: new Date().toISOString() })
        .eq("date", today);
    } catch { /* email failure is non-blocking */ }
  }

  return NextResponse.json({ success: true, briefing });
}

export async function GET() {
  // Allow fetching today's briefing
  const { data } = await supabase
    .from("ai_briefings")
    .select("*")
    .order("date", { ascending: false })
    .limit(7);

  return NextResponse.json({ briefings: data || [] });
}
