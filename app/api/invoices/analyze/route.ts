import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { processInvoice } from "@/lib/claude";

// Vercel Hobby allows up to 60s — Claude + DB writes need the headroom
export const maxDuration = 60;

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "invoices";

/**
 * Map vendor name → expense category.
 * Checks vendor name first (precise), then falls back to AI suggestion.
 */
function detectCategory(vendorName: string, aiSuggested?: string): string {
  const v = vendorName.toLowerCase();

  if (/\b(meta|facebook|instagram)\b/.test(v)) return "Marketing";
  if (/\bshopify\b/.test(v)) return "Tools & Software";
  if (/\bgodaddy\b/.test(v)) return "Infrastructure";
  if (/\bheygen\b/.test(v)) return "Tools & Software";
  if (/\bklaviyo\b/.test(v)) return "Tools & Software";
  if (/\bgoogle ads\b/.test(v)) return "Marketing";
  if (/\bgoogle\b/.test(v)) return "Tools & Software";
  if (/\b(fiverr|upwork)\b/.test(v)) return "Consulting";
  if (/\b(aws|amazon web services|digitalocean|linode|vercel|netlify|cloudflare)\b/.test(v)) return "Infrastructure";
  if (/\b(canva|figma|adobe)\b/.test(v)) return "Design";
  if (/\b(slack|notion|airtable|zapier|make\.com|n8n)\b/.test(v)) return "Tools & Software";
  if (/\b(zoom|loom|calendly)\b/.test(v)) return "Tools & Software";

  if (aiSuggested) {
    const a = aiSuggested.toLowerCase();
    if (a.includes("market") || a.includes("advertis")) return "Marketing";
    if (a.includes("software") || a.includes("saas") || a.includes("tool")) return "Tools & Software";
    if (a.includes("design") || a.includes("creative")) return "Design";
    if (a.includes("legal") || a.includes("law")) return "Legal";
    if (a.includes("account")) return "Accounting";
    if (a.includes("infra") || a.includes("hosting") || a.includes("server") || a.includes("domain")) return "Infrastructure";
    if (a.includes("salary") || a.includes("payroll")) return "Salaries";
    if (a.includes("subscri")) return "Subscriptions";
  }

  return "Miscellaneous";
}

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse JSON body ───────────────────────────────────────────────────────
  let body: { file_path: string; mime_type: string };
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: `Bad request: ${String(e)}` }, { status: 400 });
  }

  const { file_path: filePath, mime_type: mimeType } = body;
  if (!filePath || !mimeType) {
    return NextResponse.json({ error: "file_path and mime_type are required" }, { status: 400 });
  }

  // ── Download file from storage ────────────────────────────────────────────
  const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(filePath);

  if (downloadErr || !fileData) {
    const msg = downloadErr?.message ?? "Unknown download error";
    console.error("[invoices/analyze] download:", msg);
    const errBody = { ai_failed: true, file_path: filePath, error: `File download failed: ${msg}` };
    console.log("[invoices/analyze] response:", JSON.stringify(errBody));
    return NextResponse.json(errBody);
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());

  // ── Claude AI extraction ──────────────────────────────────────────────────
  let aiData: Record<string, unknown>;
  try {
    aiData = await processInvoice(buffer, mimeType);
    console.log("[invoices/analyze] claude result:", JSON.stringify(aiData));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[invoices/analyze] claude:", msg);
    const errBody = { ai_failed: true, file_path: filePath, error: `AI extraction failed: ${msg}` };
    console.log("[invoices/analyze] response:", JSON.stringify(errBody));
    return NextResponse.json(errBody);
  }

  // ── Resolve category ──────────────────────────────────────────────────────
  const vendorName = String(aiData.vendor_name ?? "Unknown Vendor");
  const category = detectCategory(vendorName, String(aiData.suggested_category ?? ""));

  // ── Auto-save invoice ─────────────────────────────────────────────────────
  // AI returns amounts in rupees; store as paise.
  const totalAmount = Math.round((Number(aiData.total_amount) || 0) * 100);
  const gstAmount   = Math.round((Number(aiData.gst_amount)   || 0) * 100);
  const baseAmount  = totalAmount - gstAmount;

  const invoiceNumber = `INV-${Date.now()}`;
  const invoiceDate   = String(aiData.invoice_date || new Date().toISOString().split("T")[0]);
  const dueDate       = aiData.due_date && aiData.due_date !== "null" ? String(aiData.due_date) : null;

  const { data: invoice, error: invErr } = await supabaseAdmin
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      type: "payable",
      vendor: vendorName,
      vendor_gstin: aiData.vendor_gstin ? String(aiData.vendor_gstin) : null,
      amount: baseAmount,
      gst_amount: gstAmount,
      date: invoiceDate,
      due_date: dueDate,
      status: "paid",
      category,
      ai_extracted_data: aiData,
      file_path: filePath,
      created_by: user.id,
    })
    .select()
    .single();

  if (invErr) {
    console.error("[invoices/analyze] invoice insert:", invErr.message);
    const errBody = { ai_failed: true, file_path: filePath, ai_data: aiData, error: `Invoice save failed: ${invErr.message}` };
    console.log("[invoices/analyze] response:", JSON.stringify({ ...errBody, ai_data: "[omitted]" }));
    return NextResponse.json(errBody);
  }

  // ── Auto-create matching transaction ─────────────────────────────────────
  const txnId = `INV-${invoiceNumber}`;
  const { data: transaction, error: txnErr } = await supabaseAdmin
    .from("transactions")
    .insert({
      txn_id: txnId,
      type: "expense",
      category,
      vendor: vendorName,
      description: `Invoice ${invoiceNumber} — ${vendorName}`.slice(0, 255),
      amount: baseAmount,
      gst_amount: gstAmount,
      gst_rate: aiData.gst_rate ? Number(aiData.gst_rate) : null,
      date: invoiceDate,
      status: "paid",
      invoice_id: invoice.id,
      notes: "Auto-created from invoice upload",
      created_by: user.id,
    })
    .select()
    .single();

  if (txnErr) {
    console.error("[invoices/analyze] transaction insert:", txnErr.message);
  }

  const successBody = { auto_saved: true, invoice, transaction: transaction ?? null, category };
  console.log("[invoices/analyze] response:", JSON.stringify({
    auto_saved: true,
    invoice_id: invoice.id,
    invoice_number: invoiceNumber,
    vendor: vendorName,
    category,
    transaction_id: transaction?.id ?? null,
  }));
  return NextResponse.json(successBody);
}
