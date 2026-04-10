import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { scenario } = await req.json();

  if (!scenario) {
    return NextResponse.json({ error: "Scenario required" }, { status: 400 });
  }

  // Gather current financial baseline
  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const [currentMonth, subscriptions, recentAds] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, category")
      .gte("date", monthStart),
    supabase
      .from("subscriptions")
      .select("name, cost, billing_cycle")
      .eq("status", "active"),
    supabase
      .from("meta_ads_daily")
      .select("spend, roas, conversions, conversion_value")
      .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),
  ]);

  const mtdRevenue = (currentMonth.data || [])
    .filter(t => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const mtdExpenses = (currentMonth.data || [])
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const monthlySubsCost = (subscriptions.data || []).reduce((s, sub) => {
    if (sub.billing_cycle === "monthly") return s + sub.cost;
    if (sub.billing_cycle === "yearly") return s + Math.round(sub.cost / 12);
    return s;
  }, 0);

  const avgDailyAdSpend = (recentAds.data || []).length > 0
    ? (recentAds.data || []).reduce((s, a) => s + a.spend, 0) / (recentAds.data || []).length
    : 0;
  const avgRoas = (recentAds.data || []).length > 0
    ? (recentAds.data || []).reduce((s, a) => s + (a.roas || 0), 0) / (recentAds.data || []).length
    : 0;

  const baseline = {
    currentMonthRevenue: mtdRevenue / 100,
    currentMonthExpenses: mtdExpenses / 100,
    currentMonthProfit: (mtdRevenue - mtdExpenses) / 100,
    monthlySubscriptionBurn: monthlySubsCost / 100,
    avgDailyAdSpend: avgDailyAdSpend / 100,
    avgRoas: avgRoas,
    currency: "INR",
  };

  const prompt = `You are a financial modeler for TKOA Private Limited, an Indian e-commerce company selling Shopify automation templates and online courses via Shopify.

CURRENT BASELINE (this month so far):
${JSON.stringify(baseline, null, 2)}

USER'S SCENARIO:
"${scenario}"

Model this scenario's financial impact. Analyze:
1. Direct revenue/cost impact
2. Second-order effects (e.g., more ad spend → more sales → more Shopify fees)
3. Cash flow timeline (when do costs hit vs when revenue comes in)
4. Break-even point if applicable
5. Risks and assumptions

Respond in this EXACT JSON format:
{
  "scenario_summary": "one sentence describing what you modeled",
  "monthly_impact": {
    "revenue_change": <paise, can be negative>,
    "expense_change": <paise, can be negative>,
    "profit_change": <paise, can be negative>,
    "new_monthly_revenue": <paise>,
    "new_monthly_expenses": <paise>,
    "new_monthly_profit": <paise>
  },
  "timeline": [
    {"month": "Month 1", "revenue": <paise>, "expenses": <paise>, "profit": <paise>, "note": "..."},
    {"month": "Month 3", "revenue": <paise>, "expenses": <paise>, "profit": <paise>, "note": "..."},
    {"month": "Month 6", "revenue": <paise>, "expenses": <paise>, "profit": <paise>, "note": "..."}
  ],
  "break_even": "Month X" or null,
  "key_assumptions": ["assumption 1", "assumption 2"],
  "risks": ["risk 1", "risk 2"],
  "recommendation": "Go / No-go / Conditional — with reasoning"
}

Use INR paise (₹1 = 100 paise) for all monetary values.`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

  if (!result) {
    return NextResponse.json({ error: "Failed to model scenario" }, { status: 500 });
  }

  return NextResponse.json({ success: true, scenario, baseline, result });
}
