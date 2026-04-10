import { createClient } from "@/lib/supabase/server";
import { BankStatementsClient } from "./BankStatementsClient";

export default async function BankStatementsPage() {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .limit(200);

  return <BankStatementsClient transactions={transactions || []} allRows={transactions || []} />;
}
