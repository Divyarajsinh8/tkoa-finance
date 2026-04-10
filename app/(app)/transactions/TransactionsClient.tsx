"use client";

import { useState, useMemo } from "react";
import { Transaction, UserRole, TransactionType, TransactionStatus } from "@/types";
import { formatINR, formatDate, statusColor, cn } from "@/lib/utils";
import { getPermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { TransactionForm } from "@/components/transactions/TransactionForm";

const CATEGORIES = [
  "Marketing", "Subscriptions", "Salaries", "Infrastructure", "Tools & Software",
  "Advertising", "Design", "Legal", "Accounting", "Office", "Travel", "Miscellaneous",
  "Shopify Revenue", "Consulting", "Refunds",
];

interface Props {
  transactions: Transaction[];
  role: UserRole;
}

export function TransactionsClient({ transactions: initialTxns, role }: Props) {
  const perms = getPermissions(role);
  const supabase = createClient();

  const [transactions, setTransactions] = useState(initialTxns);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | TransactionType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | TransactionStatus>("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.vendor.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.txn_id.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, search, filterType, filterStatus, filterCategory]);

  async function handleDelete(id: string) {
    if (!perms.canDelete) return;
    if (!confirm("Delete this transaction?")) return;
    await supabase.from("transactions").delete().eq("id", id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSave(txn: Partial<Transaction>) {
    if (editTxn) {
      const { data } = await supabase
        .from("transactions")
        .update(txn)
        .eq("id", editTxn.id)
        .select()
        .single();
      if (data) setTransactions((prev) => prev.map((t) => (t.id === data.id ? data : t)));
    } else {
      const { data } = await supabase
        .from("transactions")
        .insert(txn)
        .select()
        .single();
      if (data) setTransactions((prev) => [data, ...prev]);
    }
    setShowForm(false);
    setEditTxn(null);
  }

  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-green-400">+{formatINR(totalIncome, true)}</span>
            <span className="text-white/20 text-xs">/</span>
            <span className="font-mono text-xs text-red-400">-{formatINR(totalExpense, true)}</span>
          </div>
          <span className="text-white/20 text-xs font-mono">{filtered.length} records</span>
        </div>
        <div className="flex items-center gap-2">
          {perms.canExport && (
            <button className="btn-ghost py-1.5 px-3 text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          )}
          {perms.canCreate && (
            <button onClick={() => { setEditTxn(null); setShowForm(true); }} className="btn-primary py-1.5 px-3 text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Transaction
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search vendor, category, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base text-xs py-1.5 w-56"
        />

        {/* Type filter */}
        <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
          {(["all", "income", "expense"] as const).map((t) => (
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
          onChange={(e) => setFilterStatus(e.target.value as "all" | TransactionStatus)}
          className="input-base text-xs py-1 bg-[#111116] cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="received">Received</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="input-base text-xs py-1 bg-[#111116] cursor-pointer"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["ID", "Date", "Vendor", "Category", "Amount", "GST", "Method", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 data-label whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-white/20">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map((txn) => (
                  <tr key={txn.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-white/30">{txn.txn_id}</td>
                    <td className="px-4 py-3 font-mono text-white/60 whitespace-nowrap">{formatDate(txn.date)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white/85 font-medium">{txn.vendor}</p>
                        {txn.description && <p className="text-white/30 text-[10px] mt-0.5 truncate max-w-[180px]">{txn.description}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/60">{txn.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("font-mono font-medium", txn.type === "income" ? "text-green-400" : "text-red-400")}>
                        {txn.type === "income" ? "+" : "-"}{formatINR(txn.amount, true)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/40">
                      {txn.gst_amount > 0 ? formatINR(txn.gst_amount, true) : "-"}
                    </td>
                    <td className="px-4 py-3 text-white/40 capitalize">{txn.payment_method?.replace("_", " ") ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("status-badge", statusColor(txn.status))}>{txn.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {perms.canEdit && (
                          <button
                            onClick={() => { setEditTxn(txn); setShowForm(true); }}
                            className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-all cursor-pointer"
                            title="Edit"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {perms.canDelete && (
                          <button
                            onClick={() => handleDelete(txn.id)}
                            className="w-7 h-7 rounded flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/5 transition-all cursor-pointer"
                            title="Delete"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Form Modal */}
      {showForm && (
        <TransactionForm
          transaction={editTxn}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTxn(null); }}
          categories={CATEGORIES}
        />
      )}
    </div>
  );
}
