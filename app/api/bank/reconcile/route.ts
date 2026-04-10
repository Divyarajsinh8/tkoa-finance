import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findMatches, BankTxnInput, SystemTxnInput } from "@/lib/reconciliation";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch unmatched bank transactions (last 90 days)
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const [{ data: bankTxns }, { data: sysTxns }] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select("id, transaction_date, description, debit_amount, credit_amount")
      .eq("status", "unmatched")
      .gte("transaction_date", since.toISOString().split("T")[0]),
    supabase
      .from("transactions")
      .select("id, date, amount, type, vendor, description, category")
      .gte("date", since.toISOString().split("T")[0])
      .in("status", ["paid", "received"]),
  ]);

  if (!bankTxns?.length) {
    return NextResponse.json({ autoMatched: 0, suggestions: 0, message: "No unmatched transactions" });
  }

  const { autoMatches, suggestions } = findMatches(
    bankTxns as BankTxnInput[],
    (sysTxns ?? []) as SystemTxnInput[]
  );

  // Apply auto-matches
  let autoMatchedCount = 0;
  for (const match of autoMatches) {
    const { error } = await supabase
      .from("bank_transactions")
      .update({
        status: "matched",
        matched_transaction_id: match.systemTxnId,
        match_confidence: match.score / 100,
      })
      .eq("id", match.bankTxnId);

    if (!error) autoMatchedCount++;
  }

  // Store suggestions as "suggested" status
  for (const match of suggestions) {
    await supabase
      .from("bank_transactions")
      .update({
        status: "suggested",
        matched_transaction_id: match.systemTxnId,
        match_confidence: match.score / 100,
      })
      .eq("id", match.bankTxnId);
  }

  return NextResponse.json({
    autoMatched: autoMatchedCount,
    suggestions: suggestions.length,
    message: `Auto-matched ${autoMatchedCount} transactions. ${suggestions.length} need review.`,
  });
}

// Confirm or reject a suggested match
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bankTxnId, action, systemTxnId } = await req.json();

  if (action === "confirm") {
    await supabase
      .from("bank_transactions")
      .update({ status: "matched", matched_transaction_id: systemTxnId })
      .eq("id", bankTxnId);
  } else if (action === "reject") {
    await supabase
      .from("bank_transactions")
      .update({ status: "unmatched", matched_transaction_id: null, match_confidence: null })
      .eq("id", bankTxnId);
  }

  return NextResponse.json({ success: true });
}
