import { createClient } from "@/lib/supabase/server";
import { TaxClient } from "./TaxClient";

export default async function TaxPage() {
  const supabase = await createClient();

  const now = new Date();
  // Indian FY quarters: Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar
  const currentMonth = now.getMonth(); // 0-indexed
  let quarterStart: Date;
  if (currentMonth >= 3 && currentMonth <= 5) {
    quarterStart = new Date(now.getFullYear(), 3, 1); // Apr
  } else if (currentMonth >= 6 && currentMonth <= 8) {
    quarterStart = new Date(now.getFullYear(), 6, 1); // Jul
  } else if (currentMonth >= 9 && currentMonth <= 11) {
    quarterStart = new Date(now.getFullYear(), 9, 1); // Oct
  } else {
    quarterStart = new Date(now.getFullYear(), 0, 1); // Jan
  }

  const { data: quarterTxns } = await supabase
    .from("transactions")
    .select("type, category, vendor, amount, gst_amount, gst_rate, date, status")
    .gte("date", quarterStart.toISOString().split("T")[0])
    .in("status", ["paid", "received"]);

  const { data: invoicesNoGST } = await supabase
    .from("invoices")
    .select("vendor, amount, vendor_gstin")
    .is("vendor_gstin", null)
    .eq("type", "payable");

  return <TaxClient quarterTxns={quarterTxns ?? []} invoicesNoGST={invoicesNoGST ?? []} quarterStart={quarterStart.toISOString().split("T")[0]} />;
}
