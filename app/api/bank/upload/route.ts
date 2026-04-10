import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Indian bank CSV parsers
// Each bank has a different CSV format — we detect and parse accordingly

interface ParsedTransaction {
  transaction_date: string;
  value_date?: string;
  description: string;
  reference_number?: string;
  debit_amount: number; // paise
  credit_amount: number; // paise
  balance?: number; // paise
}

function parseAmount(str: string): number {
  if (!str || str.trim() === "" || str.trim() === "-") return 0;
  const cleaned = str.replace(/[₹,\s]/g, "").replace(/Dr\.?|Cr\.?/gi, "").trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val * 100);
}

function parseDate(str: string): string {
  if (!str) return "";
  // Handle DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY, YYYY-MM-DD
  const s = str.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  // DD MMM YYYY or DD-MMM-YYYY
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const dmonthY = s.match(/^(\d{1,2})[\s\-]?([A-Za-z]{3})[\s\-]?(\d{2,4})$/);
  if (dmonthY) {
    const month = months[dmonthY[2].toLowerCase()];
    const year = dmonthY[3].length === 2 ? `20${dmonthY[3]}` : dmonthY[3];
    if (month) return `${year}-${month}-${dmonthY[1].padStart(2, "0")}`;
  }

  return s;
}

function detectBank(headers: string[]): string {
  const h = headers.join(" ").toLowerCase();
  if (h.includes("hdfc")) return "HDFC";
  if (h.includes("icici")) return "ICICI";
  if (h.includes("sbi") || h.includes("state bank")) return "SBI";
  if (h.includes("kotak")) return "Kotak";
  if (h.includes("axis")) return "Axis";
  if (h.includes("yes bank")) return "Yes Bank";
  return "Unknown";
}

function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    // Handle quoted fields
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  });
}

function parseHDFC(rows: string[][]): ParsedTransaction[] {
  // HDFC format: Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance
  const txns: ParsedTransaction[] = [];
  let dataStarted = false;

  for (const row of rows) {
    if (!dataStarted) {
      if (row[0]?.toLowerCase().includes("date")) { dataStarted = true; continue; }
      continue;
    }
    if (!row[0] || row.length < 6) continue;
    const dateStr = parseDate(row[0]);
    if (!dateStr) continue;

    txns.push({
      transaction_date: dateStr,
      value_date: parseDate(row[3]),
      description: (row[1] || "").trim(),
      reference_number: (row[2] || "").trim() || undefined,
      debit_amount: parseAmount(row[4]),
      credit_amount: parseAmount(row[5]),
      balance: row[6] ? parseAmount(row[6]) : undefined,
    });
  }
  return txns;
}

function parseICICI(rows: string[][]): ParsedTransaction[] {
  // ICICI format: S No. | Value Date | Transaction Date | Cheque Number | Transaction Remarks | Withdrawal Amount (INR) | Deposit Amount (INR) | Balance (INR)
  const txns: ParsedTransaction[] = [];
  let dataStarted = false;

  for (const row of rows) {
    if (!dataStarted) {
      if (row.some(c => c.toLowerCase().includes("transaction date"))) { dataStarted = true; continue; }
      continue;
    }
    if (!row[2] || row.length < 7) continue;
    const dateStr = parseDate(row[2]);
    if (!dateStr) continue;

    txns.push({
      transaction_date: dateStr,
      value_date: parseDate(row[1]),
      description: (row[4] || "").trim(),
      reference_number: (row[3] || "").trim() || undefined,
      debit_amount: parseAmount(row[5]),
      credit_amount: parseAmount(row[6]),
      balance: row[7] ? parseAmount(row[7]) : undefined,
    });
  }
  return txns;
}

function parseGeneric(rows: string[][]): ParsedTransaction[] {
  // Generic parser — tries to detect columns by header names
  let headerRowIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const rowText = row.join(" ").toLowerCase();
    if (rowText.includes("date") && (rowText.includes("debit") || rowText.includes("withdrawal") || rowText.includes("credit") || rowText.includes("deposit"))) {
      headerRowIdx = i;
      headers = row.map(h => h.toLowerCase().trim());
      break;
    }
  }

  if (headerRowIdx === -1) return [];

  const findCol = (...names: string[]) =>
    headers.findIndex(h => names.some(n => h.includes(n)));

  const dateCol = findCol("transaction date", "txn date", "date");
  const valueDateCol = findCol("value date", "value dt");
  const descCol = findCol("narration", "description", "particulars", "remarks", "details");
  const refCol = findCol("cheque", "reference", "chq", "ref");
  const debitCol = findCol("debit", "withdrawal", "dr");
  const creditCol = findCol("credit", "deposit", "cr");
  const balanceCol = findCol("balance", "closing");

  if (dateCol === -1) return [];

  const txns: ParsedTransaction[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[dateCol]) continue;
    const dateStr = parseDate(row[dateCol]);
    if (!dateStr || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

    txns.push({
      transaction_date: dateStr,
      value_date: valueDateCol >= 0 ? parseDate(row[valueDateCol]) : undefined,
      description: (descCol >= 0 ? row[descCol] : "").trim(),
      reference_number: (refCol >= 0 ? row[refCol] : "").trim() || undefined,
      debit_amount: debitCol >= 0 ? parseAmount(row[debitCol]) : 0,
      credit_amount: creditCol >= 0 ? parseAmount(row[creditCol]) : 0,
      balance: balanceCol >= 0 && row[balanceCol] ? parseAmount(row[balanceCol]) : undefined,
    });
  }
  return txns;
}

function parseBankCSV(content: string, bankHint?: string): { bank: string; transactions: ParsedTransaction[] } {
  const rows = parseCSV(content);
  if (rows.length === 0) return { bank: "Unknown", transactions: [] };

  const bank = bankHint || detectBank(rows[0]);

  let transactions: ParsedTransaction[] = [];
  if (bank === "HDFC") {
    transactions = parseHDFC(rows);
  } else if (bank === "ICICI") {
    transactions = parseICICI(rows);
  } else {
    transactions = parseGeneric(rows);
  }

  return { bank, transactions: transactions.filter(t => t.transaction_date) };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bankName = formData.get("bank") as string || undefined;
    const accountLast4 = formData.get("account_last4") as string || undefined;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const content = await file.text();
    const { bank, transactions } = parseBankCSV(content, bankName);

    if (transactions.length === 0) {
      return NextResponse.json({ error: "Could not parse bank statement. Please check the format." }, { status: 400 });
    }

    // Insert all transactions
    const rows = transactions.map(t => ({
      bank_name: bank,
      account_number_last4: accountLast4 || null,
      transaction_date: t.transaction_date,
      value_date: t.value_date || null,
      description: t.description,
      reference_number: t.reference_number || null,
      debit_amount: t.debit_amount,
      credit_amount: t.credit_amount,
      balance: t.balance ?? null,
      status: "unmatched",
    }));

    const { data, error } = await supabase
      .from("bank_transactions")
      .insert(rows)
      .select();

    if (error) throw new Error(error.message);

    // Trigger AI auto-categorization in background
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${appUrl}/api/ai/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "bank_import", count: rows.length }),
    }).catch(() => { /* non-blocking */ });

    return NextResponse.json({
      success: true,
      bank,
      imported: rows.length,
      credits: rows.filter(r => r.credit_amount > 0).length,
      debits: rows.filter(r => r.debit_amount > 0).length,
      rows: data,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
