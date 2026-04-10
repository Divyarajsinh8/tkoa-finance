import { createClient } from "@/lib/supabase/server";
import { TransactionsClient } from "./TransactionsClient";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .single();

  return (
    <TransactionsClient
      transactions={transactions ?? []}
      role={userProfile?.role ?? "viewer"}
    />
  );
}
