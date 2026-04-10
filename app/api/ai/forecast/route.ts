import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  // Gather 6 months of daily revenue data
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [ordersRes, txnsRes, adsRes] = await Promise.all([
    supabase
      .from("shopify_orders")
      .select("total_amount, created_at, store")
      .gte("created_at", sixMonthsAgo.toISOString())
      .eq("payment_status", "paid")
      .order("created_at"),
    supabase
      .from("transactions")
      .select("type, amount, date, category")
      .gte("date", sixMonthsAgo.toISOString().split("T")[0])
      .order("date"),
    supabase
      .from("meta_ads_daily")
      .select("date, spend, roas, conversions")
      .gte("date", sixMonthsAgo.toISOString().split("T")[0])
      .order("date"),
  ]);

  // Aggregate by month
  const monthlyData: Record<string, { revenue: number; expenses: number; adSpend: number; orders: number }> = {};

  for (const order of ordersRes.data || []) {
    const month = order.created_at.slice(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expenses: 0, adSpend: 0, orders: 0 };
    monthlyData[month].revenue += order.total_amount;
    monthlyData[month].orders += 1;
  }

  for (const txn of txnsRes.data || []) {
    const month = txn.date.slice(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expenses: 0, adSpend: 0, orders: 0 };
    if (txn.type === "expense") monthlyData[month].expenses += txn.amount;
  }

  for (const ad of adsRes.data || []) {
    const month = ad.date.slice(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, expenses: 0, adSpend: 0, orders: 0 };
    monthlyData[month].adSpend += ad.spend;
  }

  const history = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      revenue: data.revenue / 100,
      expenses: data.expenses / 100,
      adSpend: data.adSpend / 100,
      orders: data.orders,
      profit: (data.revenue - data.expenses) / 100,
    }));

  const prompt = `You are a financial analyst for TKOA Private Limited, an Indian e-commerce company selling Shopify automation templates and online courses.

Based on this 6-month historical data, generate revenue forecasts for the next 30, 60, and 90 days.

HISTORICAL DATA (monthly):
${JSON.stringify(history, null, 2)}

Analyze:
1. Month-over-month growth trends
2. Revenue-to-ad-spend correlation
3. Seasonal patterns
4. Recent momentum

Generate forecasts in this EXACT JSON format:
{
  "forecasts": [
    {
      "metric": "revenue",
      "period": "30d",
      "optimistic": <number in paise>,
      "expected": <number in paise>,
      "pessimistic": <number in paise>,
      "assumptions": {
        "growth_rate": "X%",
        "key_drivers": "...",
        "risks": "..."
      }
    },
    // repeat for 60d and 90d
  ],
  "summary": "2-3 sentence narrative on the business trajectory"
}

Use Indian Rupees, convert to paise (multiply by 100) for the numbers.`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

  if (!parsed?.forecasts) {
    return NextResponse.json({ error: "Failed to generate forecast" }, { status: 500 });
  }

  // Save forecasts
  const today = new Date().toISOString().split("T")[0];
  const forecastRows = parsed.forecasts.map((f: {
    metric: string;
    period: string;
    optimistic: number;
    expected: number;
    pessimistic: number;
    assumptions: Record<string, unknown>;
  }) => ({
    metric: f.metric,
    period: f.period,
    forecast_date: today,
    optimistic: f.optimistic,
    expected: f.expected,
    pessimistic: f.pessimistic,
    assumptions: f.assumptions,
  }));

  await supabase.from("ai_forecasts").insert(forecastRows);

  return NextResponse.json({
    success: true,
    forecasts: parsed.forecasts,
    summary: parsed.summary,
    basedOn: history.length + " months of data",
  });
}

export async function GET() {
  // Return latest forecasts
  const { data } = await supabase
    .from("ai_forecasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(9); // 3 periods × 3 metrics

  return NextResponse.json({ forecasts: data || [] });
}
