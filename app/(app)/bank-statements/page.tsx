import { createClient } from "@/lib/supabase/server";
import { BankStatementsClient } from "./BankStatementsClient";

export default async function BankStatementsPage() {
  const supabase = await createClient();

  // allRows for summary stats (no limit)
  const { data: allRows } = await supabase
    .from("bank_transactions")
    .select("id, credit_amount, debit_amount, status, match_confidence, matched_transaction_id")
    .order("transaction_date", { ascending: false });

  // Full rows for the transactions table (limited for performance)
  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .limit(200);

  return (
    <BankStatementsClient
      transactions={transactions ?? []}
      allRows={allRows ?? []}
    />
  );
}
