"use client";

import { useMemo, useState } from "react";
import { formatINR, formatDate, cn } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface CashfreeTxn {
  id: string;
  cf_order_id: string;
  order_amount: number;
  payment_amount: number;
  payment_status: string;
  payment_method: string;
  card_network: string;
  bank_name: string;
  upi_id: string;
  payment_time: string;
  settlement_amount: number;
  settlement_date: string;
  customer_email: string;
}

interface ShopifyPayout {
  id: string;
  store: string;
  payout_id: string;
  amount: number;
  fees: number;
  net_amount: number;
  status: string;
  date: string;
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#DC3C3C", "#ec4899"];

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a24",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

export function PaymentsHubClient({ transactions, payouts }: { transactions: CashfreeTxn[]; payouts: ShopifyPayout[] }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const successful = transactions.filter(t => t.payment_status === "SUCCESS");
  const failed = transactions.filter(t => t.payment_status === "FAILED");
  const totalVolume = successful.reduce((s, t) => s + t.order_amount, 0);
  const successRate = transactions.length > 0 ? (successful.length / transactions.length * 100).toFixed(1) : "0";

  // Payment method breakdown
  const methodBreakdown = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const t of successful) {
      const method = t.payment_method || "unknown";
      if (!map[method]) map[method] = { count: 0, amount: 0 };
      map[method].count += 1;
      map[method].amount += t.order_amount;
    }
    return Object.entries(map)
      .map(([method, d]) => ({ method, count: d.count, amount: d.amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [successful]);

  // Pending settlements
  const pendingSettlements = transactions.filter(t => t.payment_status === "SUCCESS" && !t.settlement_date);
  const pendingAmount = pendingSettlements.reduce((s, t) => s + t.order_amount, 0);

  // Shopify payout summary
  const totalPayoutNet = payouts.reduce((s, p) => s + (p.net_amount || 0), 0);
  const totalPayoutFees = payouts.reduce((s, p) => s + (p.fees || 0), 0);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/cashfree", { method: "POST" });
      const data = await res.json();
      setSyncMsg(res.ok ? `Synced ${data.records} records!` : `Error: ${data.error}`);
    } catch {
      setSyncMsg("Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-heading font-bold text-xl">Payments Hub</h1>
          <p className="text-white/40 text-sm mt-0.5">Cashfree + Shopify Payouts — last 30 days</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#DC3C3C]/10 hover:bg-[#DC3C3C]/20 text-[#DC3C3C] rounded-lg border border-[#DC3C3C]/20 transition-all disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={cn(syncing && "animate-spin")}>
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {syncing ? "Syncing..." : "Sync Cashfree"}
        </button>
      </div>

      {syncMsg && (
        <div className={cn("px-4 py-2 rounded-lg text-sm border", syncMsg.includes("Error") ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20")}>
          {syncMsg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Volume", value: formatINR(totalVolume, true), color: "text-green-400" },
          { label: "Successful", value: successful.length.toString(), color: "text-green-400" },
          { label: "Failed", value: failed.length.toString(), color: failed.length > 0 ? "text-red-400" : "text-white" },
          { label: "Success Rate", value: `${successRate}%`, color: parseFloat(successRate) >= 95 ? "text-green-400" : "text-orange-400" },
          { label: "Pending Settlement", value: formatINR(pendingAmount, true), color: "text-orange-400" },
          { label: "Shopify Payout Net", value: formatINR(totalPayoutNet, true), color: "text-blue-400" },
        ].map(kpi => (
          <div key={kpi.label} className="card-base p-4">
            <p className="text-white/40 text-xs mb-1">{kpi.label}</p>
            <p className={cn("font-mono font-bold text-base", kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Method breakdown + Shopify payouts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-base p-5">
          <h3 className="section-title mb-4">Payment Method Breakdown</h3>
          {methodBreakdown.length === 0 ? (
            <p className="text-white/20 text-sm text-center py-6">No payment data — sync Cashfree first</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={methodBreakdown} dataKey="amount" cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                    {methodBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [formatINR(Number(v), true), "Amount"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {methodBreakdown.map((m, i) => (
                  <div key={m.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-white/70 text-xs capitalize">{m.method}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-white/70 text-xs font-mono">{formatINR(m.amount, true)}</p>
                      <p className="text-white/30 text-[10px]">{m.count} txns</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card-base p-5">
          <h3 className="section-title mb-4">Shopify Payouts</h3>
          {payouts.length === 0 ? (
            <p className="text-white/20 text-sm text-center py-6">No payout data — sync Shopify first</p>
          ) : (
            <>
              <div className="flex gap-4 mb-4">
                <div>
                  <p className="text-white/30 text-xs">Total Net</p>
                  <p className="text-green-400 font-mono font-bold">{formatINR(totalPayoutNet, true)}</p>
                </div>
                <div>
                  <p className="text-white/30 text-xs">Fees Paid</p>
                  <p className="text-orange-400 font-mono font-bold">{formatINR(totalPayoutFees, true)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {payouts.slice(0, 6).map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-xs">{p.store} · {formatDate(p.date)}</p>
                      <p className="text-white/30 text-[10px]">Fee: {formatINR(p.fees, true)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-mono text-xs">{formatINR(p.net_amount, true)}</p>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded",
                        p.status === "paid" ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"
                      )}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Transaction table */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">Recent Cashfree Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Order ID", "Amount", "Status", "Method", "Customer", "Settlement", "Date"].map(h => (
                  <th key={h} className="pb-2 text-left text-white/30 font-medium pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 25).map(t => (
                <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="py-2 pr-4 font-mono text-white/50 text-[10px]">{t.cf_order_id?.slice(-8)}</td>
                  <td className="py-2 pr-4 font-mono text-white/80">{formatINR(t.order_amount, true)}</td>
                  <td className="py-2 pr-4">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                      t.payment_status === "SUCCESS" ? "bg-green-500/10 text-green-400" :
                      t.payment_status === "FAILED" ? "bg-red-500/10 text-red-400" :
                      "bg-white/[0.06] text-white/40"
                    )}>{t.payment_status}</span>
                  </td>
                  <td className="py-2 pr-4 text-white/50 capitalize">{t.payment_method || "—"}</td>
                  <td className="py-2 pr-4 text-white/40 max-w-[120px] truncate">{t.customer_email || "—"}</td>
                  <td className="py-2 pr-4">
                    {t.settlement_date ? (
                      <span className="text-green-400 text-[10px]">{formatDate(t.settlement_date)}</span>
                    ) : (
                      <span className="text-orange-400 text-[10px]">Pending</span>
                    )}
                  </td>
                  <td className="py-2 text-white/30 font-mono">
                    {t.payment_time ? formatDate(t.payment_time.split("T")[0]) : "—"}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-white/20">No transaction data — configure Cashfree and sync</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
