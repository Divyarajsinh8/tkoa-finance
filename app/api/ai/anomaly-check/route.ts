import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyCronSecret(req: Request): boolean {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET || process.env.NODE_ENV === "development";
}

interface Alert {
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  data?: Record<string, unknown>;
}

async function checkRevenueAnomaly(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(today.getTime() - 48 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: recentOrders } = await supabase
    .from("shopify_orders")
    .select("total_amount, created_at, store")
    .gte("created_at", `${twoDaysAgo}T00:00:00`)
    .eq("payment_status", "paid");

  if (!recentOrders) return alerts;

  const ydayRevenue = recentOrders
    .filter(o => o.created_at.startsWith(yesterday))
    .reduce((s, o) => s + o.total_amount, 0);

  const prevDayRevenue = recentOrders
    .filter(o => o.created_at.startsWith(twoDaysAgo))
    .reduce((s, o) => s + o.total_amount, 0);

  if (prevDayRevenue > 0 && ydayRevenue < prevDayRevenue * 0.5) {
    const drop = ((prevDayRevenue - ydayRevenue) / prevDayRevenue * 100).toFixed(1);
    alerts.push({
      severity: "critical",
      category: "revenue",
      title: `Revenue dropped ${drop}% yesterday`,
      description: `Yesterday's revenue (₹${(ydayRevenue / 100).toFixed(0)}) is ${drop}% lower than the previous day (₹${(prevDayRevenue / 100).toFixed(0)}). Investigate immediately.`,
      data: { yesterday_revenue: ydayRevenue, prev_day_revenue: prevDayRevenue, drop_pct: drop },
    });
  }

  // Zero revenue warning
  if (ydayRevenue === 0 && prevDayRevenue > 0) {
    alerts.push({
      severity: "critical",
      category: "revenue",
      title: "No revenue recorded yesterday",
      description: "No paid orders were received yesterday. Check if the Shopify store is live and payments are working.",
      data: { date: yesterday },
    });
  }

  return alerts;
}

async function checkAdSpendAnomaly(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: ydayAds } = await supabase
    .from("meta_ads_daily")
    .select("spend, roas, conversion_value, campaign_name, campaign_id")
    .eq("date", yesterday);

  if (!ydayAds || ydayAds.length === 0) return alerts;

  const totalSpend = ydayAds.reduce((s, a) => s + a.spend, 0);
  const totalRevenue = ydayAds.reduce((s, a) => s + a.conversion_value, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // ROAS below 1 = losing money on ads
  if (overallRoas > 0 && overallRoas < 1) {
    alerts.push({
      severity: "critical",
      category: "ads",
      title: `Ad ROAS critically low: ${overallRoas.toFixed(2)}x`,
      description: `Overall ROAS is ${overallRoas.toFixed(2)}x — you're spending ₹${(totalSpend / 100).toFixed(0)} to generate ₹${(totalRevenue / 100).toFixed(0)} in revenue. Review and pause underperforming campaigns.`,
      data: { roas: overallRoas, spend: totalSpend, revenue: totalRevenue },
    });
  } else if (overallRoas > 0 && overallRoas < 1.5) {
    alerts.push({
      severity: "warning",
      category: "ads",
      title: `Ad ROAS below target: ${overallRoas.toFixed(2)}x`,
      description: `ROAS of ${overallRoas.toFixed(2)}x is below the recommended 1.5x minimum for profitability after Shopify/Cashfree fees.`,
      data: { roas: overallRoas, spend: totalSpend },
    });
  }

  // Flag individual campaigns with ROAS < 0.5
  for (const ad of ydayAds) {
    if (ad.roas !== null && ad.roas < 0.5 && ad.spend > 50000) { // > ₹500 spend
      alerts.push({
        severity: "warning",
        category: "ads",
        title: `Campaign burning money: ${ad.campaign_name}`,
        description: `"${ad.campaign_name}" has ROAS of ${ad.roas?.toFixed(2)}x with ₹${(ad.spend / 100).toFixed(0)} spent. Consider pausing this campaign.`,
        data: { campaign_id: ad.campaign_id, campaign_name: ad.campaign_name, roas: ad.roas, spend: ad.spend },
      });
    }
  }

  return alerts;
}

async function checkSubscriptionRenewals(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const today = new Date().toISOString().split("T")[0];
  const next3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("name, cost, next_due_date, billing_cycle")
    .eq("status", "active")
    .lte("next_due_date", next3Days)
    .gte("next_due_date", today);

  if (!subs || subs.length === 0) return alerts;

  for (const sub of subs) {
    const daysUntil = Math.ceil((new Date(sub.next_due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    alerts.push({
      severity: daysUntil <= 1 ? "warning" : "info",
      category: "subscription",
      title: `${sub.name} renews ${daysUntil === 0 ? "today" : `in ${daysUntil} day${daysUntil > 1 ? "s" : ""}`}`,
      description: `${sub.name} (${sub.billing_cycle}) will charge ₹${(sub.cost / 100).toFixed(0)} on ${sub.next_due_date}.`,
      data: { name: sub.name, amount: sub.cost, due_date: sub.next_due_date },
    });
  }

  return alerts;
}

async function checkGSTDeadlines(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const today = new Date();

  // GSTR-3B due dates: 20th of month following quarter end
  // Q1 (Apr-Jun) → July 20, Q2 (Jul-Sep) → Oct 20, Q3 (Oct-Dec) → Jan 20, Q4 (Jan-Mar) → Apr 20
  const gstDeadlines = [
    { label: "Q1 GSTR-3B", date: `${today.getFullYear()}-07-20` },
    { label: "Q2 GSTR-3B", date: `${today.getFullYear()}-10-20` },
    { label: "Q3 GSTR-3B", date: `${today.getFullYear() + 1}-01-20` },
    { label: "Q4 GSTR-3B", date: `${today.getFullYear()}-04-20` },
  ];

  for (const deadline of gstDeadlines) {
    const daysUntil = Math.ceil((new Date(deadline.date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (daysUntil >= 0 && daysUntil <= 7) {
      alerts.push({
        severity: daysUntil <= 2 ? "critical" : "warning",
        category: "tax",
        title: `${deadline.label} due ${daysUntil === 0 ? "TODAY" : `in ${daysUntil} days`}`,
        description: `${deadline.label} filing deadline is ${deadline.date}. Ensure all purchase invoices are uploaded and GST reconciliation is complete.`,
        data: { deadline: deadline.date, daysUntil },
      });
    }
  }

  return alerts;
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allAlerts: Alert[] = [];

  const [revenueAlerts, adAlerts, subAlerts, gstAlerts] = await Promise.allSettled([
    checkRevenueAnomaly(),
    checkAdSpendAnomaly(),
    checkSubscriptionRenewals(),
    checkGSTDeadlines(),
  ]);

  for (const result of [revenueAlerts, adAlerts, subAlerts, gstAlerts]) {
    if (result.status === "fulfilled") {
      allAlerts.push(...result.value);
    }
  }

  if (allAlerts.length > 0) {
    await supabase.from("ai_alerts").insert(allAlerts);

    // Send critical alerts via email
    const criticalAlerts = allAlerts.filter(a => a.severity === "critical");
    if (criticalAlerts.length > 0 && process.env.RESEND_API_KEY) {
      const body = criticalAlerts
        .map(a => `🚨 ${a.title}\n${a.description}`)
        .join("\n\n");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TKOA Finance <alerts@tkoa.in>",
          to: process.env.NOTIFICATION_EMAIL,
          subject: `⚠️ ${criticalAlerts.length} Critical Alert${criticalAlerts.length > 1 ? "s" : ""} — TKOA Finance`,
          text: body,
        }),
      }).catch(() => { /* non-blocking */ });
    }
  }

  return NextResponse.json({
    success: true,
    alertsCreated: allAlerts.length,
    byCategory: {
      revenue: revenueAlerts.status === "fulfilled" ? revenueAlerts.value.length : 0,
      ads: adAlerts.status === "fulfilled" ? adAlerts.value.length : 0,
      subscriptions: subAlerts.status === "fulfilled" ? subAlerts.value.length : 0,
      tax: gstAlerts.status === "fulfilled" ? gstAlerts.value.length : 0,
    },
  });
}

export async function GET(req: Request) {
  return POST(req);
}
