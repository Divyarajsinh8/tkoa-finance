import { createClient } from "@/lib/supabase/server";
import { PLClient } from "./PLClient";

export default async function PLPage() {
  const supabase = await createClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, category, amount, gst_amount, date, status")
    .gte("date", sixMonthsAgo.toISOString().split("T")[0])
    .in("status", ["paid", "received"]);

  return <PLClient transactions={transactions ?? []} />;
}
