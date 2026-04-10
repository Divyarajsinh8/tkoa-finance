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
  match_confidence?: number;
  matched_transaction_id?: string;
  uploaded_at: string;
}

// Lighter type used for summary stats row (no full fields required)
interface BankTxnSummary {
  id: string;
  credit_amount: number;
  debit_amount: number;
  status: string;
  match_confidence?: number;
  matched_transaction_id?: string;
}

type Tab = "transactions" | "reconcile";

export function BankStatementsClient({
  transactions,
  allRows,
}: {
  transactions: BankTxn[];
  allRows: BankTxnSummary[];
}) {
  const [tab, setTab] = useState<Tab>("transactions");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [bank, setBank] = useState("");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState("");
  // localRows tracks status changes for summary counters (uses lightweight summary type)
  const [localRows, setLocalRows] = useState(allRows);
  // localTxns tracks full rows for the reconcile UI
  const [localTxns, setLocalTxns] = useState(transactions);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalCredits = localRows.reduce((s, t) => s + t.credit_amount, 0);
  const totalDebits = localRows.reduce((s, t) => s + t.debit_amount, 0);
  const matched = localRows.filter(t => t.status === "matched").length;
  const suggested = localRows.filter(t => t.status === "suggested").length;
  const unmatched = localRows.filter(t => t.status === "unmatched").length;

  const filteredTxns = localTxns.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.description?.toLowerCase().includes(q) ||
      t.auto_category?.toLowerCase().includes(q) ||
      t.bank_name?.toLowerCase().includes(q)
    );
  });

  const suggestedRows = localTxns.filter(t => t.status === "suggested");
  const unmatchedRows = localTxns.filter(t => t.status === "unmatched");

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
        setUploadMsg(
          `✓ Imported ${data.imported} transactions from ${data.bank} — ${data.credits} credits, ${data.debits} debits. Refresh to see them.`
        );
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

  async function runReconciliation() {
    setReconciling(true);
    setReconcileMsg("");
    try {
      const res = await fetch("/api/bank/reconcile", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setReconcileMsg(
          `✓ ${data.message} Refresh the page to see updated statuses.`
        );
      } else {
        setReconcileMsg(`Error: ${data.error}`);
      }
    } catch {
      setReconcileMsg("Reconciliation failed. Please try again.");
    } finally {
      setReconciling(false);
    }
  }

  async function handleMatchAction(bankTxnId: string, action: "confirm" | "reject", systemTxnId?: string) {
    const res = await fetch("/api/bank/reconcile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankTxnId, action, systemTxnId }),
    });

    if (res.ok) {
      const updater = <T extends { id: string; status: string; matched_transaction_id?: string; match_confidence?: number }>(prev: T[]): T[] =>
        prev.map(r => {
          if (r.id !== bankTxnId) return r;
          if (action === "confirm") return { ...r, status: "matched" };
          return { ...r, status: "unmatched", matched_transaction_id: undefined, match_confidence: undefined };
        });
      setLocalRows(updater);
      setLocalTxns(updater);
    }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-white font-heading font-bold text-xl">Bank Statements</h1>
        <p className="text-white/40 text-sm mt-0.5">Upload CSV from HDFC, ICICI, SBI, Kotak, Axis</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Total Credits</p>
          <p className="font-mono font-bold text-green-400">{formatINR(totalCredits, true)}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Total Debits</p>
          <p className="font-mono font-bold text-red-400">{formatINR(totalDebits, true)}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Matched</p>
          <p className="font-mono font-bold text-green-400">{matched}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Needs Review</p>
          <p className={cn("font-mono font-bold", suggested > 0 ? "text-yellow-400" : "text-white/30")}>{suggested}</p>
        </div>
        <div className="card-base p-4">
          <p className="text-white/40 text-xs mb-1">Unmatched</p>
          <p className={cn("font-mono font-bold", unmatched > 0 ? "text-orange-400" : "text-green-400")}>{unmatched}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5 w-fit">
        {(["transactions", "reconcile"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-all cursor-pointer",
              tab === t ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60"
            )}
          >
            {t === "reconcile" ? (
              <span className="flex items-center gap-1.5">
                Reconcile
                {(suggested + unmatched) > 0 && (
                  <span className="bg-orange-400/20 text-orange-400 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                    {suggested + unmatched}
                  </span>
                )}
              </span>
            ) : "Transactions"}
          </button>
        ))}
      </div>

      {/* ── TRANSACTIONS TAB ─────────────────────────────── */}
      {tab === "transactions" && (
        <>
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

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
                dragOver
                  ? "border-[#DC3C3C]/60 bg-[#DC3C3C]/5"
                  : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
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
              <div className={cn(
                "mt-3 px-4 py-2 rounded-lg text-sm border",
                uploadMsg.startsWith("✓")
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              )}>
                {uploadMsg}
              </div>
            )}
          </div>

          {/* Transaction table */}
          {filteredTxns.length > 0 && (
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
                    {filteredTxns.slice(0, 50).map(t => (
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
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px]",
                            t.status === "matched"
                              ? "bg-green-500/10 text-green-400"
                              : t.status === "suggested"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-orange-500/10 text-orange-400"
                          )}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTxns.length > 50 && (
                  <p className="text-white/20 text-xs text-center py-3">
                    Showing 50 of {filteredTxns.length} transactions
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── RECONCILE TAB ─────────────────────────────────── */}
      {tab === "reconcile" && (
        <div className="space-y-4">
          {/* Run engine */}
          <div className="card-base p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="section-title mb-1">Reconciliation Engine</h3>
                <p className="text-white/40 text-sm">
                  Automatically matches bank transactions to system transactions by amount, date, and vendor name.
                  Auto-matches at high confidence; flags close matches for review.
                </p>
              </div>
              <button
                onClick={runReconciliation}
                disabled={reconciling}
                className="btn-primary py-2 px-4 text-sm whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reconciling ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Running...
                  </span>
                ) : "Run Reconciliation"}
              </button>
            </div>

            {reconcileMsg && (
              <div className={cn(
                "mt-4 px-4 py-2.5 rounded-lg text-sm border",
                reconcileMsg.startsWith("✓")
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              )}>
                {reconcileMsg}
              </div>
            )}

            {/* Status summary */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { label: "Matched", count: matched, color: "text-green-400" },
                { label: "Suggested — Needs Review", count: suggested, color: "text-yellow-400" },
                { label: "Unmatched", count: unmatched, color: "text-orange-400" },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.05]">
                  <p className="text-white/30 text-[10px] mb-1">{s.label}</p>
                  <p className={cn("font-mono text-2xl font-bold", s.color)}>{s.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested matches — needs review */}
          {suggestedRows.length > 0 && (
            <div className="card-base p-5">
              <h3 className="section-title mb-4">
                Suggested Matches
                <span className="ml-2 text-yellow-400/70 text-[10px] font-mono">— review and confirm</span>
              </h3>
              <div className="space-y-3">
                {suggestedRows.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0 gap-4">
                    <div className="min-w-0">
                      <p className="text-white/70 text-sm truncate">{t.description}</p>
                      <p className="text-white/30 text-xs font-mono mt-0.5">
                        {formatDate(t.transaction_date)} ·{" "}
                        {t.debit_amount > 0
                          ? <span className="text-red-400">{formatINR(t.debit_amount, true)}</span>
                          : <span className="text-green-400">{formatINR(t.credit_amount, true)}</span>}
                        {t.match_confidence !== undefined && (
                          <span className="ml-2 text-yellow-400/70">
                            {Math.round(t.match_confidence * 100)}% confidence
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleMatchAction(t.id, "confirm", t.matched_transaction_id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleMatchAction(t.id, "reject")}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.05] text-white/40 hover:bg-white/[0.08] transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched transactions */}
          {unmatchedRows.length > 0 && (
            <div className="card-base p-5">
              <h3 className="section-title mb-4">
                Unmatched Transactions
                <span className="ml-2 text-orange-400/70 text-[10px] font-mono">— no match found</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Date", "Description", "Amount", "Category"].map(h => (
                        <th key={h} className="pb-2 text-left text-white/30 font-medium pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedRows.slice(0, 30).map(t => (
                      <tr key={t.id} className="border-b border-white/[0.03]">
                        <td className="py-2 pr-4 font-mono text-white/50">{formatDate(t.transaction_date)}</td>
                        <td className="py-2 pr-4 text-white/60 max-w-[240px] truncate">{t.description}</td>
                        <td className="py-2 pr-4 font-mono">
                          {t.debit_amount > 0
                            ? <span className="text-red-400">{formatINR(t.debit_amount, true)}</span>
                            : <span className="text-green-400">{formatINR(t.credit_amount, true)}</span>}
                        </td>
                        <td className="py-2 pr-4">
                          {t.auto_category
                            ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400">{t.auto_category}</span>
                            : <span className="text-white/20">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {unmatchedRows.length > 30 && (
                  <p className="text-white/20 text-xs text-center py-3">
                    Showing 30 of {unmatchedRows.length} unmatched
                  </p>
                )}
              </div>
            </div>
          )}

          {suggestedRows.length === 0 && unmatchedRows.length === 0 && (
            <div className="card-base p-10 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-white/60 font-medium">All bank transactions are reconciled</p>
              <p className="text-white/30 text-sm mt-1">Run reconciliation after uploading new statements</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
