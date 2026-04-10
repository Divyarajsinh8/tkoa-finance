import { createClient } from "@/lib/supabase/server";
import { BudgetClient } from "./BudgetClient";

export default async function BudgetPage() {
  const supabase = await createClient();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const [{ data: budgets }, { data: transactions }, { data: profile }] = await Promise.all([
    supabase.from("budgets").select("*").gte("month", firstOfMonth).lt("month", new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split("T")[0]),
    supabase.from("transactions").select("category, amount, type").gte("date", firstOfMonth).eq("type", "expense").in("status", ["paid"]),
    supabase.from("users").select("role").single(),
  ]);

  return <BudgetClient budgets={budgets ?? []} transactions={transactions ?? []} role={profile?.role ?? "viewer"} currentMonth={firstOfMonth} />;
}
