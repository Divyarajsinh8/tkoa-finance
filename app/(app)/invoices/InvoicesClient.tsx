"use client";

import { useState, useRef } from "react";
import { Invoice, UserRole } from "@/types";
import { formatINR, formatDate, statusColor, cn } from "@/lib/utils";
import { getPermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";

interface Props {
  invoices?: Invoice[];
  role: UserRole;
}

export function InvoicesClient({ invoices: initialInvoices = [], role }: Props) {
  const perms = getPermissions(role);
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [invoices, setInvoices] = useState(initialInvoices);
  const [filterType, setFilterType] = useState<"all" | "payable" | "receivable">("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = invoices.filter((inv) => {
    if (filterType !== "all" && inv.type !== filterType) return false;
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    return true;
  });

  async function handleUpload(file: File) {
    if (!perms.canCreate) return;
    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Process with AI
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/invoices/process", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const extracted = await res.json();
        setAiResult(extracted);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-white/30">{filtered.length} invoices</span>
        </div>
        {perms.canCreate && (
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary py-1.5 px-3 text-xs disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {uploading ? "Uploading…" : "Upload Invoice"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
          </div>
        )}
      </div>

      {/* Upload Zone */}
      {perms.canCreate && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-white/[0.08] rounded-xl p-8 text-center hover:border-[#DC3C3C]/30 hover:bg-[#DC3C3C]/[0.02] transition-all duration-200 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <>
                <svg className="animate-spin w-8 h-8 text-[#DC3C3C]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-white/50 text-sm">Processing with AI…</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <p className="text-white/50 text-sm">Drop invoice PDF or image here</p>
                <p className="text-white/25 text-xs">AI will extract vendor, amount, GST, and create a transaction automatically</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* AI Result Preview */}
      {aiResult && (
        <div className="card-base p-4 border-[#DC3C3C]/20 border-[#DC3C3C]/10 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#DC3C3C] animate-pulse" />
              <span className="text-sm font-medium text-white">AI Extracted Data</span>
            </div>
            <button onClick={() => setAiResult(null)} className="text-white/30 hover:text-white/60 cursor-pointer transition-colors text-xs">Dismiss</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {Object.entries(aiResult).filter(([k]) => !["line_items"].includes(k)).map(([k, v]) => (
              <div key={k}>
                <p className="data-label">{k.replace(/_/g, " ")}</p>
                <p className="font-mono text-white/80 text-xs mt-0.5">{String(v) || "—"}</p>
              </div>
            ))}
          </div>
          <button className="btn-primary mt-3 py-1.5 px-3 text-xs">
            Create Transaction from Invoice
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
          {(["all", "payable", "receivable"] as const).map((t) => (
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
          onChange={(e) => setFilterStatus(e.target.value)}
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
          filtered.map((inv) => (
            <div key={inv.id} className="card-base p-4 hover:border-white/[0.1] transition-all duration-200 group cursor-pointer">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-white/30">{inv.invoice_number}</p>
                  <p className="text-white/85 font-medium text-sm mt-0.5">{inv.vendor}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {inv.drive_url && (
                    <div className="w-5 h-5 rounded flex items-center justify-center text-blue-400/70" title="Synced to Drive">
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

              {/* Amount */}
              <p className="font-mono font-bold text-white text-lg">{formatINR(inv.amount, true)}</p>
              {inv.gst_amount > 0 && (
                <p className="font-mono text-xs text-white/30">+ {formatINR(inv.gst_amount, true)} GST</p>
              )}

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] text-white/30">{formatDate(inv.date)}</p>
                  {inv.due_date && (
                    <p className="font-mono text-[10px] text-yellow-400/60">Due {formatDate(inv.due_date)}</p>
                  )}
                </div>
                <span className={cn("status-badge text-[10px]", statusColor(inv.status))}>{inv.status}</span>
              </div>

              {/* Drive link */}
              {inv.drive_url && (
                <a
                  href={inv.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-[10px] text-white/25 hover:text-blue-400 transition-colors block cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
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
