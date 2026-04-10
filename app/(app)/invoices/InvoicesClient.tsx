"use client";

import { useState, useRef } from "react";
import { Invoice, UserRole } from "@/types";
import { formatINR, formatDate, statusColor, cn } from "@/lib/utils";
import { getPermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  "Marketing", "Subscriptions", "Salaries", "Infrastructure", "Tools & Software",
  "Advertising", "Design", "Legal", "Accounting", "Office", "Travel", "Miscellaneous",
  "Shopify Sales", "Consulting", "Other",
];

interface Props {
  invoices?: Invoice[];
  role: UserRole;
}

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "saved"; invoice: Invoice; transaction: unknown | null; category: string }
  | { phase: "manual"; filePath: string; reason: string; invoiceId?: string; transactionId?: string }
  | { phase: "error"; message: string };

interface ManualForm {
  vendor: string;
  type: "payable" | "receivable";
  amount: string;
  gst_amount: string;
  date: string;
  due_date: string;
  category: string;
  notes: string;
}

const EMPTY_FORM: ManualForm = {
  vendor: "",
  type: "payable",
  amount: "",
  gst_amount: "0",
  date: new Date().toISOString().split("T")[0],
  due_date: "",
  category: "",
  notes: "",
};

export function InvoicesClient({ invoices: initialInvoices = [], role }: Props) {
  const perms = getPermissions(role);
  const supabase = createClient();

  const [invoices, setInvoices] = useState(initialInvoices);
  const [filterType, setFilterType] = useState<"all" | "payable" | "receivable">("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [uploadState, setUploadState] = useState<UploadState>({ phase: "idle" });
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = invoices.filter((inv) => {
    if (filterType !== "all" && inv.type !== filterType) return false;
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    return true;
  });

  async function handleUpload(file: File) {
    if (!perms.canCreate) return;
    setUploadState({ phase: "uploading" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/invoices/process", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadState({ phase: "error", message: data.error ?? `Server error ${res.status}` });
        return;
      }

      if (data.auto_saved && data.invoice) {
        // Full success — AI extracted + auto-saved
        setInvoices(prev => [data.invoice as Invoice, ...prev]);
        setUploadState({ phase: "saved", invoice: data.invoice as Invoice, transaction: data.transaction ?? null, category: data.category ?? "" });
        return;
      }

      if (data.ai_failed) {
        // File uploaded but AI failed — show manual form pre-filled if ai_data available
        const aiData = data.ai_data as Record<string, unknown> | undefined;
        if (aiData) {
          setManualForm({
            vendor: String(aiData.vendor_name ?? ""),
            type: "payable",
            amount: String(Number(aiData.total_amount ?? 0)),
            gst_amount: String(Number(aiData.gst_amount ?? 0)),
            date: String(aiData.invoice_date ?? new Date().toISOString().split("T")[0]),
            due_date: aiData.due_date && aiData.due_date !== "null" ? String(aiData.due_date) : "",
            category: String(aiData.suggested_category ?? ""),
            notes: "",
          });
        } else {
          setManualForm(EMPTY_FORM);
        }
        setUploadState({
          phase: "manual",
          filePath: data.file_path ?? "",
          reason: data.error ?? "AI extraction failed — please fill in the details.",
        });
        return;
      }

      setUploadState({ phase: "error", message: "Unexpected response from server." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUploadState({ phase: "error", message: `Network error: ${msg}` });
    }
  }

  async function saveManualInvoice(filePath: string, invoiceId?: string, transactionId?: string) {
    if (!manualForm.vendor.trim()) return;
    setSaving(true);
    try {
      const amount = Math.round(parseFloat(manualForm.amount || "0") * 100);
      const gstAmount = Math.round(parseFloat(manualForm.gst_amount || "0") * 100);
      const userId = (await supabase.auth.getUser()).data.user?.id;

      if (invoiceId) {
        // UPDATE existing invoice
        const { data, error } = await supabase
          .from("invoices")
          .update({
            type: manualForm.type,
            vendor: manualForm.vendor.trim(),
            amount,
            gst_amount: gstAmount,
            date: manualForm.date,
            due_date: manualForm.due_date || null,
            category: manualForm.category || null,
            notes: manualForm.notes || null,
          })
          .eq("id", invoiceId)
          .select()
          .single();

        if (error) throw new Error(error.message);

        // Update linked transaction if present
        if (transactionId) {
          await supabase
            .from("transactions")
            .update({
              type: manualForm.type === "payable" ? "expense" : "income",
              category: manualForm.category || null,
              vendor: manualForm.vendor.trim(),
              amount,
              gst_amount: gstAmount,
              date: manualForm.date,
            })
            .eq("id", transactionId);
        }

        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? (data as Invoice) : inv));
        setUploadState({ phase: "idle" });
        setManualForm(EMPTY_FORM);
      } else {
        // INSERT new invoice
        const invoiceNumber = `INV-${Date.now()}`;
        const { data, error } = await supabase
          .from("invoices")
          .insert({
            invoice_number: invoiceNumber,
            type: manualForm.type,
            vendor: manualForm.vendor.trim(),
            amount,
            gst_amount: gstAmount,
            date: manualForm.date,
            due_date: manualForm.due_date || null,
            status: "paid",
            category: manualForm.category || null,
            notes: manualForm.notes || null,
            file_path: filePath,
            created_by: userId,
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        setInvoices(prev => [data as Invoice, ...prev]);
        setUploadState({ phase: "idle" });
        setManualForm(EMPTY_FORM);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUploadState(prev =>
        prev.phase === "manual"
          ? { ...prev, reason: `Save failed: ${msg}` }
          : { phase: "error", message: `Save failed: ${msg}` }
      );
    } finally {
      setSaving(false);
    }
  }

  function enterEditMode(invoice: Invoice, transactionId?: string) {
    setManualForm({
      vendor: invoice.vendor ?? "",
      type: invoice.type as "payable" | "receivable",
      amount: String((invoice.amount ?? 0) / 100),
      gst_amount: String((invoice.gst_amount ?? 0) / 100),
      date: invoice.date ?? new Date().toISOString().split("T")[0],
      due_date: invoice.due_date ?? "",
      category: invoice.category ?? "",
      notes: (invoice as Invoice & { notes?: string }).notes ?? "",
    });
    setUploadState({
      phase: "manual",
      filePath: invoice.file_path ?? "",
      reason: "Editing saved invoice",
      invoiceId: invoice.id,
      transactionId,
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function dismissUpload() {
    setUploadState({ phase: "idle" });
    setManualForm(EMPTY_FORM);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isUploading = uploadState.phase === "uploading";

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/30">{filtered.length} invoices</span>
        {perms.canCreate && (
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn-primary py-1.5 px-3 text-xs disabled:opacity-50 cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {isUploading ? "Uploading…" : "Upload Invoice"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            />
          </div>
        )}
      </div>

      {/* Upload Drop Zone */}
      {perms.canCreate && uploadState.phase === "idle" && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/[0.08] rounded-xl p-8 text-center hover:border-[#DC3C3C]/30 hover:bg-[#DC3C3C]/[0.02] transition-all duration-200 cursor-pointer"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-white/50 text-sm">Drop invoice PDF or image here</p>
            <p className="text-white/25 text-xs">AI extracts vendor, amount, GST and saves automatically · PDF, JPEG, PNG, WebP</p>
          </div>
        </div>
      )}

      {/* Uploading spinner */}
      {uploadState.phase === "uploading" && (
        <div className="card-base p-6 flex items-center gap-4">
          <svg className="animate-spin w-6 h-6 text-[#DC3C3C] shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="text-white/70 text-sm font-medium">Uploading & processing…</p>
            <p className="text-white/30 text-xs mt-0.5">Saving to storage, then running AI extraction</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {uploadState.phase === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p className="text-red-400 text-sm font-semibold">Upload failed</p>
                <p className="text-red-400/70 text-xs mt-1 font-mono">{uploadState.message}</p>
              </div>
            </div>
            <button onClick={dismissUpload} className="text-white/30 hover:text-white/60 text-xs cursor-pointer shrink-0">Dismiss</button>
          </div>
        </div>
      )}

      {/* Auto-save success card */}
      {uploadState.phase === "saved" && (
        <div className="card-base p-5 border border-green-500/20 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Invoice saved automatically</span>
            </div>
            <button onClick={dismissUpload} className="text-white/30 hover:text-white/60 cursor-pointer transition-colors text-xs">Done</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="data-label">Vendor</p>
              <p className="text-white/80 text-sm font-medium mt-0.5">{uploadState.invoice.vendor}</p>
            </div>
            <div>
              <p className="data-label">Amount</p>
              <p className="font-mono text-white text-sm font-bold mt-0.5">{formatINR(uploadState.invoice.amount, true)}</p>
              {uploadState.invoice.gst_amount > 0 && (
                <p className="font-mono text-white/30 text-[10px]">+ {formatINR(uploadState.invoice.gst_amount, true)} GST</p>
              )}
            </div>
            <div>
              <p className="data-label">Category</p>
              <p className="text-white/80 text-sm mt-0.5">{uploadState.category || uploadState.invoice.category || "—"}</p>
            </div>
            <div>
              <p className="data-label">Date</p>
              <p className="font-mono text-white/80 text-sm mt-0.5">{formatDate(uploadState.invoice.date)}</p>
            </div>
          </div>

          {!!uploadState.transaction && (
            <p className="text-green-400/60 text-xs mb-4">
              Transaction auto-created and linked
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => enterEditMode(
                uploadState.invoice,
                uploadState.transaction ? (uploadState.transaction as { id?: string }).id : undefined
              )}
              className="btn-ghost py-1.5 px-3 text-xs cursor-pointer border border-white/[0.08]"
            >
              Edit
            </button>
            <button onClick={dismissUpload} className="btn-primary py-1.5 px-3 text-xs cursor-pointer">
              Done
            </button>
          </div>
        </div>
      )}

      {/* Manual entry / edit form */}
      {uploadState.phase === "manual" && (
        <div className="card-base p-5 animate-slide-up">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="section-title">
                {uploadState.invoiceId ? "Edit Invoice" : "Invoice Details"}
              </h3>
              <p className="text-white/30 text-xs mt-0.5">{uploadState.reason}</p>
            </div>
            <button onClick={dismissUpload} className="text-white/30 hover:text-white/60 text-xs cursor-pointer">Cancel</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Vendor */}
            <div>
              <label className="data-label block mb-1.5">Vendor Name *</label>
              <input
                type="text"
                value={manualForm.vendor}
                onChange={e => setManualForm(f => ({ ...f, vendor: e.target.value }))}
                placeholder="e.g. AWS, Canva, Freelancer"
                className="input-base w-full"
              />
            </div>

            {/* Type */}
            <div>
              <label className="data-label block mb-1.5">Invoice Type *</label>
              <div className="flex bg-white/[0.04] rounded-lg p-0.5">
                {(["payable", "receivable"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setManualForm(f => ({ ...f, type: t }))}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all cursor-pointer",
                      manualForm.type === t ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="data-label block mb-1.5">Amount (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualForm.amount}
                onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="input-base w-full font-mono"
              />
            </div>

            {/* GST Amount */}
            <div>
              <label className="data-label block mb-1.5">GST Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualForm.gst_amount}
                onChange={e => setManualForm(f => ({ ...f, gst_amount: e.target.value }))}
                placeholder="0.00"
                className="input-base w-full font-mono"
              />
            </div>

            {/* Date */}
            <div>
              <label className="data-label block mb-1.5">Invoice Date *</label>
              <input
                type="date"
                value={manualForm.date}
                onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
                className="input-base w-full font-mono"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="data-label block mb-1.5">Due Date</label>
              <input
                type="date"
                value={manualForm.due_date}
                onChange={e => setManualForm(f => ({ ...f, due_date: e.target.value }))}
                className="input-base w-full font-mono"
              />
            </div>

            {/* Category */}
            <div>
              <label className="data-label block mb-1.5">Category</label>
              <select
                value={manualForm.category}
                onChange={e => setManualForm(f => ({ ...f, category: e.target.value }))}
                className="input-base w-full"
              >
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="data-label block mb-1.5">Notes</label>
              <input
                type="text"
                value={manualForm.notes}
                onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                className="input-base w-full"
              />
            </div>
          </div>

          {uploadState.filePath && (
            <div className="mt-3 flex items-center gap-2 text-xs text-white/25">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              File saved: <span className="font-mono">{uploadState.filePath}</span>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => saveManualInvoice(uploadState.filePath, uploadState.invoiceId, uploadState.transactionId)}
              disabled={saving || !manualForm.vendor.trim() || !manualForm.amount}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Saving…" : uploadState.invoiceId ? "Update Invoice" : "Save Invoice"}
            </button>
            <button onClick={dismissUpload} className="btn-ghost py-2 px-4 text-sm cursor-pointer">Discard</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
          {(["all", "payable", "receivable"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-all duration-150 cursor-pointer font-medium capitalize",
                filterType === t ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="input-base text-xs py-1 bg-[#111116] cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Invoice Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-16 text-white/20">
            No invoices found
          </div>
        ) : (
          filtered.map(inv => (
            <div key={inv.id} className="card-base p-4 hover:border-white/[0.1] transition-all duration-200 cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-white/30">{inv.invoice_number}</p>
                  <p className="text-white/85 font-medium text-sm mt-0.5">{inv.vendor}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {inv.drive_url && (
                    <div className="w-5 h-5 flex items-center justify-center text-blue-400/70" title="Synced to Drive">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 16 12 13 15 11 15 8 12 2 12" />
                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                      </svg>
                    </div>
                  )}
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    inv.type === "payable" ? "bg-red-400/10 text-red-400" : "bg-green-400/10 text-green-400"
                  )}>
                    {inv.type}
                  </span>
                </div>
              </div>

              <p className="font-mono font-bold text-white text-lg">{formatINR(inv.amount, true)}</p>
              {inv.gst_amount > 0 && (
                <p className="font-mono text-xs text-white/30">+ {formatINR(inv.gst_amount, true)} GST</p>
              )}

              <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] text-white/30">{formatDate(inv.date)}</p>
                  {inv.due_date && (
                    <p className="font-mono text-[10px] text-yellow-400/60">Due {formatDate(inv.due_date)}</p>
                  )}
                </div>
                <span className={cn("status-badge text-[10px]", statusColor(inv.status))}>{inv.status}</span>
              </div>

              {inv.drive_url && (
                <a
                  href={inv.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-[10px] text-white/25 hover:text-blue-400 transition-colors block"
                  onClick={e => e.stopPropagation()}
                >
                  View in Drive →
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
