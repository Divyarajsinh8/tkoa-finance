import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALERT_THRESHOLD = 0.8; // 80%

export async function POST(req: NextRequest) {
  // Allow cron calls with CRON_SECRET
  const cronSecret = req.headers.get("x-cron-secret");
  const supabase = await createClient();

  if (cronSecret !== process.env.CRON_SECRET) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString()
    .split("T")[0];

  const [{ data: budgets }, { data: transactions }] = await Promise.all([
    supabase
      .from("budgets")
      .select("category, budgeted_amount")
      .gte("month", firstOfMonth)
      .lt("month", firstOfNextMonth),
    supabase
      .from("transactions")
      .select("category, amount")
      .gte("date", firstOfMonth)
      .eq("type", "expense")
      .in("status", ["paid"]),
  ]);

  if (!budgets?.length) {
    return NextResponse.json({ checked: 0, alerts: 0 });
  }

  const actualByCategory = (transactions ?? []).reduce(
    (acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    },
    {}
  );

  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  let alertsCreated = 0;

  for (const budget of budgets) {
    const actual = actualByCategory[budget.category] ?? 0;
    if (budget.budgeted_amount === 0) continue;

    const pct = actual / budget.budgeted_amount;
    if (pct < ALERT_THRESHOLD) continue;

    const isOver = pct >= 1;
    const severity = isOver ? "critical" : "warning";
    const pctDisplay = Math.round(pct * 100);
    const dedupKey = `budget-${budget.category}-${firstOfMonth}-${isOver ? "over" : "warn"}`;

    const { error } = await supabase.from("ai_alerts").upsert(
      {
        severity,
        category: "budget",
        title: isOver
          ? `${budget.category} budget exceeded`
          : `${budget.category} at ${pctDisplay}% of budget`,
        description: isOver
          ? `You've spent ₹${(actual / 100).toLocaleString("en-IN")} against a ₹${(budget.budgeted_amount / 100).toLocaleString("en-IN")} budget for ${budget.category} in ${monthLabel}.`
          : `${budget.category} spending has reached ${pctDisplay}% of the ${monthLabel} budget. ₹${((budget.budgeted_amount - actual) / 100).toLocaleString("en-IN")} remaining.`,
        data: { category: budget.category, actual, budget: budget.budgeted_amount, pct, month: firstOfMonth },
        is_read: false,
        is_dismissed: false,
        dedup_key: dedupKey,
      },
      { onConflict: "dedup_key", ignoreDuplicates: true }
    );

    if (!error) alertsCreated++;
  }

  return NextResponse.json({
    checked: budgets.length,
    alerts: alertsCreated,
    month: firstOfMonth,
  });
}
