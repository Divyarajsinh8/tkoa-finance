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

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Last 7 days
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekStr = weekAgo.toISOString().split("T")[0];
  const prevWeekStr = prevWeekStart.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [thisWeekOrders, lastWeekOrders, thisWeekAds, , thisWeekTxns, topSubs] = await Promise.all([
    supabase.from("shopify_orders").select("total_amount, store, payment_status, is_new_customer").gte("created_at", weekStr),
    supabase.from("shopify_orders").select("total_amount, store, payment_status").gte("created_at", prevWeekStr).lt("created_at", weekStr),
    supabase.from("meta_ads_daily").select("spend, roas, conversions, conversion_value, campaign_name, impressions, clicks").gte("date", weekStr),
    supabase.from("meta_ads_daily").select("spend, roas, conversions, conversion_value").gte("date", prevWeekStr).lt("date", weekStr),
    supabase.from("transactions").select("type, amount, category, vendor").gte("date", weekStr),
    supabase.from("subscriptions").select("name, cost, next_due_date").eq("status", "active").order("cost", { ascending: false }).limit(5),
  ]);

  const w = thisWeekOrders.data || [];
  const pw = lastWeekOrders.data || [];
  const thisRevenue = w.filter(o => o.payment_status === "paid").reduce((s, o) => s + o.total_amount, 0);
  const prevRevenue = pw.filter(o => o.payment_status === "paid").reduce((s, o) => s + o.total_amount, 0);
  const newCustomers = w.filter(o => o.is_new_customer).length;
  const totalOrders = w.filter(o => o.payment_status === "paid").length;

  const ads = thisWeekAds.data || [];
  const totalAdSpend = ads.reduce((s, a) => s + a.spend, 0);
  const totalConversions = ads.reduce((s, a) => s + a.conversions, 0);
  const avgRoas = ads.length > 0 ? ads.reduce((s, a) => s + (a.roas || 0), 0) / ads.length : 0;

  // Best/worst campaigns
  const campaignMap: Record<string, { spend: number; roas: number; conversions: number }> = {};
  for (const ad of ads) {
    if (!ad.campaign_name) continue;
    if (!campaignMap[ad.campaign_name]) campaignMap[ad.campaign_name] = { spend: 0, roas: 0, conversions: 0 };
    campaignMap[ad.campaign_name].spend += ad.spend;
    campaignMap[ad.campaign_name].conversions += ad.conversions;
  }

  const campaigns = Object.entries(campaignMap)
    .map(([name, d]) => ({ name, ...d, roas: d.spend > 0 ? (d.conversions * (thisRevenue / Math.max(totalOrders, 1))) / d.spend : 0 }))
    .sort((a, b) => b.roas - a.roas);

  const txns = thisWeekTxns.data || [];
  const totalExpenses = txns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const context = {
    week: { start: weekStr, end: todayStr },
    revenue: { this: thisRevenue / 100, prev: prevRevenue / 100, change: prevRevenue > 0 ? ((thisRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) + "%" : "N/A" },
    orders: totalOrders,
    newCustomers,
    aov: totalOrders > 0 ? (thisRevenue / 100 / totalOrders).toFixed(0) : 0,
    ads: { spend: totalAdSpend / 100, roas: avgRoas.toFixed(2), conversions: totalConversions },
    expenses: totalExpenses / 100,
    profit: (thisRevenue - totalExpenses) / 100,
    bestCampaign: campaigns[0] || null,
    worstCampaign: campaigns[campaigns.length - 1] || null,
    upcomingRenewals: (topSubs.data || []).filter(s => {
      const daysUntil = s.next_due_date ? Math.ceil((new Date(s.next_due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 999;
      return daysUntil <= 14;
    }),
  };

  const prompt = `You are the AI financial analyst for TKOA Private Limited. Generate a comprehensive weekly performance report for Raj.

DATA:
${JSON.stringify(context, null, 2)}

Format as a professional weekly report with these sections:
# Weekly Report — ${new Date(weekStr).toLocaleDateString("en-IN", { month: "long", day: "numeric" })} to ${new Date(todayStr).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}

## Revenue Summary
[Key metrics with % change vs last week]

## Marketing Performance
[Ad spend, ROAS, best/worst campaigns]

## Expenses & Profitability
[Expense breakdown, net profit, margin]

## Key Wins
[2-3 highlights]

## Watch List
[2-3 concerns or risks]

## Recommended Actions for Next Week
[3-5 specific, actionable items with clear reasoning]

Keep it concise, data-driven, and focused on decisions. Use ₹ with Indian number formatting.`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";

  // Send via email
  if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "TKOA Finance <reports@tkoa.in>",
        to: process.env.NOTIFICATION_EMAIL,
        subject: `Weekly Report — ${new Date(weekStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} to ${new Date(todayStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`,
        text: content,
        html: `<div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #f9fafb;">
<pre style="white-space: pre-wrap; background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">${content}</pre>
<p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
<a href="${process.env.NEXT_PUBLIC_APP_URL}/reports" style="color: #DC3C3C;">View full dashboard</a> · TKOA Finance
</p></div>`,
      }),
    }).catch(() => { /* non-blocking */ });
  }

  return NextResponse.json({ success: true, content, context });
}

export async function GET(req: Request) {
  return POST(req);
}
