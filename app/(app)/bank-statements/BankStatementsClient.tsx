"use client";

import { useState, useRef } from "react";
import { formatINR, formatDate, cn } from "@/lib/utils";

interface BankTxn {
  id: string;
  bank_name: string;
  account_number_last4: string;
  transaction_date: string;
  description: string;
  reference_number: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  auto_category: string;
  status: string;
  uploaded_at: string;
}

export function BankStatementsClient({ transactions, allRows }: { transactions: BankTxn[]; allRows: BankTxn[] }) {
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [bank, setBank] = useState("");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalCredits = allRows.reduce((s, t) => s + t.credit_amount, 0);
  const totalDebits = allRows.reduce((s, t) => s + t.debit_amount, 0);
  const unmatched = allRows.filter(t => t.status === "unmatched").length;

  const filtered = transactions.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      return t.description?.toLowerCase().includes(q) ||
        t.auto_category?.toLowerCase().includes(q) ||
        t.bank_name?.toLowerCase().includes(q);
    }
    return true;
  });

  async function uploadFile(file: File) {
    if (!file) return;
    setUploading(true);
    setUploadMsg("");

    const form = new FormData();
    form.append("file", file);
    if (bank) form.append("bank", bank);

    try {
      const res = await fetch("/api/bank/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg(`✓ Imported ${data.imported} transactions from ${data.bank} — ${data.credits} credits, ${data.debits} debits. Refresh to see them.`);
      } else {
        setUploadMsg(`Error: ${data.error}`);
      }
    } catch {
      setUploadMsg("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) uploadFile(file);
    else setUploadMsg("Please upload a CSV file.");
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-white font-heading font-bold text-xl">Bank Statements</h1>
        <p className="text-white/40 text-sm mt-0.5">Upload CSV from HDFC, ICICI, SBI, Kotak, Axis</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Total Credits</p>
          <p className="font-mono font-bold text-green-400">{formatINR(totalCredits, true)}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Total Debits</p>
          <p className="font-mono font-bold text-red-400">{formatINR(totalDebits, true)}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Transactions</p>
          <p className="font-mono font-bold text-white">{allRows.length}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Unmatched</p>
          <p className={cn("font-mono font-bold", unmatched > 0 ? "text-orange-400" : "text-green-400")}>{unmatched}</p>
        </div>
      </div>

      {/* Upload zone */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">Upload Bank Statement</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="data-label">Bank (optional — auto-detected)</label>
            <select
              value={bank}
              onChange={e => setBank(e.target.value)}
              className="input-base w-full mt-1"
            >
              <option value="">Auto-detect</option>
              <option value="HDFC">HDFC Bank</option>
              <option value="ICICI">ICICI Bank</option>
              <option value="SBI">SBI</option>
              <option value="Kotak">Kotak Mahindra</option>
              <option value="Axis">Axis Bank</option>
              <option value="Yes Bank">Yes Bank</option>
            </select>
          </div>
        </div>

        {/* Drag-drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
            dragOver ? "border-[#DC3C3C]/60 bg-[#DC3C3C]/5" : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
          )}
        >
          <svg className="w-10 h-10 mx-auto mb-3 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-white/50 text-sm font-medium">Drop CSV here or click to browse</p>
          <p className="text-white/25 text-xs mt-1">Supports HDFC, ICICI, SBI, Kotak, Axis formats</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
          />
        </div>

        {uploading && (
          <div className="mt-3 flex items-center gap-2 text-white/50 text-sm">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Processing and categorizing...
          </div>
        )}

        {uploadMsg && (
          <div className={cn("mt-3 px-4 py-2 rounded-lg text-sm border", uploadMsg.startsWith("✓") ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
            {uploadMsg}
          </div>
        )}
      </div>

      {/* Transaction table */}
      {transactions.length > 0 && (
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">All Transactions</h3>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base text-xs px-3 py-1.5 w-48"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Date", "Description", "Debit", "Credit", "Balance", "Category", "Status"].map(h => (
                    <th key={h} className="pb-2 text-left text-white/30 font-medium pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(t => (
                  <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 pr-4 font-mono text-white/50">{formatDate(t.transaction_date)}</td>
                    <td className="py-2 pr-4 text-white/70 max-w-[200px] truncate">{t.description}</td>
                    <td className="py-2 pr-4 font-mono text-red-400">{t.debit_amount > 0 ? formatINR(t.debit_amount, true) : "—"}</td>
                    <td className="py-2 pr-4 font-mono text-green-400">{t.credit_amount > 0 ? formatINR(t.credit_amount, true) : "—"}</td>
                    <td className="py-2 pr-4 font-mono text-white/30">{t.balance ? formatINR(t.balance, true) : "—"}</td>
                    <td className="py-2 pr-4">
                      {t.auto_category ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">{t.auto_category}</span>
                      ) : (
                        <span className="text-white/20 text-[10px]">Uncategorized</span>
                      )}
                    </td>
                    <td className="py-2">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px]",
                        t.status === "matched" ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"
                      )}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 50 && (
              <p className="text-white/20 text-xs text-center py-3">Showing 50 of {filtered.length} transactions</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
