import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const firstOfThisMonth = firstOfMonth;

  // Current month transactions
  const { data: currentMonthTxns } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", firstOfThisMonth)
    .order("date", { ascending: false });

  // Last month transactions
  const { data: lastMonthTxns } = await supabase
    .from("transactions")
    .select("*")
    .gte("date", firstOfLastMonth)
    .lt("date", firstOfThisMonth);

  // Last 6 months for chart
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];
  const { data: chartTxns } = await supabase
    .from("transactions")
    .select("type, amount, date, category")
    .gte("date", sixMonthsAgo);

  // Pending invoices
  const { data: pendingPayable } = await supabase
    .from("invoices")
    .select("amount, vendor, due_date")
    .eq("type", "payable")
    .in("status", ["pending", "overdue"]);

  const { data: pendingReceivable } = await supabase
    .from("invoices")
    .select("amount, vendor, due_date")
    .eq("type", "receivable")
    .in("status", ["pending", "overdue"]);

  // Recent transactions
  const { data: recentTxns } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  // GST calculation (current quarter)
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    .toISOString()
    .split("T")[0];

  const { data: quarterTxns } = await supabase
    .from("transactions")
    .select("type, gst_amount")
    .gte("date", quarterStart);

  return (
    <DashboardClient
      currentMonthTxns={currentMonthTxns ?? []}
      lastMonthTxns={lastMonthTxns ?? []}
      chartTxns={chartTxns ?? []}
      pendingPayable={pendingPayable ?? []}
      pendingReceivable={pendingReceivable ?? []}
      recentTxns={recentTxns ?? []}
      quarterTxns={quarterTxns ?? []}
    />
  );
}
