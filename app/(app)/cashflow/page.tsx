import { createClient } from "@/lib/supabase/server";
import { CashFlowClient } from "./CashFlowClient";

export default async function CashFlowPage() {
  const supabase = await createClient();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, amount, date, status, vendor, is_recurring, recurring_frequency")
    .gte("date", sixMonthsAgo.toISOString().split("T")[0])
    .in("status", ["paid", "received"]);

  const { data: pendingInvoices } = await supabase
    .from("invoices")
    .select("type, amount, vendor, due_date, status")
    .in("status", ["pending", "overdue"]);

  return <CashFlowClient transactions={transactions ?? []} pendingInvoices={pendingInvoices ?? []} />;
}
