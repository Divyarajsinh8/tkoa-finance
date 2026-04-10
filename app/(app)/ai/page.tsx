import { createClient } from "@/lib/supabase/server";
import { AIAdvisorClient } from "./AIAdvisorClient";

export default async function AIAdvisorPage() {
  const supabase = await createClient();

  // Gather financial context for the AI
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const [
    { data: currentMonthTxns },
    { data: subscriptions },
    { data: pendingInvoices },
  ] = await Promise.all([
    supabase.from("transactions").select("type,category,amount,gst_amount,vendor,status,date").gte("date", firstOfMonth),
    supabase.from("subscriptions").select("name,cost,billing_cycle,status").eq("status", "active"),
    supabase.from("invoices").select("type,amount,vendor,status,due_date").in("status", ["pending", "overdue"]),
  ]);

  const revenue = (currentMonthTxns ?? []).filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = (currentMonthTxns ?? []).filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const monthlySubBurn = (subscriptions ?? []).reduce((s, sub) => {
    const multiplier = sub.billing_cycle === "monthly" ? 1 : sub.billing_cycle === "quarterly" ? 1/3 : 1/12;
    return s + Math.round(sub.cost * multiplier);
  }, 0);

  const financialContext = {
    currentMonth: now.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    revenue_paise: revenue,
    expenses_paise: expenses,
    net_profit_paise: revenue - expenses,
    net_margin_pct: revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(1) : "0",
    monthly_sub_burn_paise: monthlySubBurn,
    active_subscriptions: subscriptions?.length ?? 0,
    pending_payable_count: (pendingInvoices ?? []).filter(i => i.type === "payable").length,
    pending_receivable_count: (pendingInvoices ?? []).filter(i => i.type === "receivable").length,
    top_expense_categories: Object.entries(
      (currentMonthTxns ?? [])
        .filter(t => t.type === "expense")
        .reduce((acc: Record<string, number>, t) => {
          acc[t.category] = (acc[t.category] ?? 0) + t.amount;
          return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => ({ category: cat, amount_paise: amt })),
  };

  return <AIAdvisorClient financialContext={financialContext} />;
}
