"use client";

import { formatINR, formatDate, cn } from "@/lib/utils";
import { BarChart } from "@/components/dashboard/BarChart";

interface Txn {
  type: string;
  amount: number;
  date: string;
  status: string;
  vendor: string;
  is_recurring: boolean;
  recurring_frequency?: string;
}

interface Invoice {
  type: string;
  amount: number;
  vendor: string;
  due_date?: string;
  status: string;
}

interface Props {
  transactions: Txn[];
  pendingInvoices: Invoice[];
}

export function CashFlowClient({ transactions, pendingInvoices }: Props) {
  const now = new Date();

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "short" }),
    };
  });

  const chartData = months.map(m => {
    const monthTxns = transactions.filter(t => t.date.startsWith(m.key));
    return {
      month: m.label,
      revenue: monthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expenses: monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    };
  });

  const netFlows = chartData.map(d => ({ ...d, net: d.revenue - d.expenses }));

  const pendingPayable = pendingInvoices.filter(i => i.type === "payable");
  const pendingReceivable = pendingInvoices.filter(i => i.type === "receivable");

  const totalPayable = pendingPayable.reduce((s, i) => s + i.amount, 0);
  const totalReceivable = pendingReceivable.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="max-w-5xl space-y-5">
      <h2 className="page-title text-xl">Cash Flow</h2>

      {/* Net Flow Trend */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">Monthly Cash Flow</h3>
        <BarChart data={chartData} />

        {/* Net cash flow row */}
        <div className="mt-4 grid grid-cols-6 gap-2 border-t border-white/[0.06] pt-4">
          {netFlows.map(d => (
            <div key={d.month} className="text-center">
              <p className="data-label text-[10px] mb-1">{d.month}</p>
              <p className={cn("font-mono text-xs font-medium", d.net >= 0 ? "text-green-400" : "text-red-400")}>
                {d.net >= 0 ? "+" : ""}{formatINR(d.net, true)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending AP / AR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title text-sm">Pending Payables</h3>
            <span className="font-mono text-xs text-red-400">{formatINR(totalPayable, true)}</span>
          </div>
          {pendingPayable.length === 0 ? (
            <p className="text-white/20 text-sm text-center py-4">All clear</p>
          ) : (
            <div className="space-y-2">
              {pendingPayable.map((inv, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm font-medium">{inv.vendor}</p>
                    {inv.due_date && <p className="text-white/30 text-xs font-mono">Due {formatDate(inv.due_date)}</p>}
                  </div>
                  <span className="font-mono text-sm text-red-400">{formatINR(inv.amount, true)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title text-sm">Pending Receivables</h3>
            <span className="font-mono text-xs text-green-400">{formatINR(totalReceivable, true)}</span>
          </div>
          {pendingReceivable.length === 0 ? (
            <p className="text-white/20 text-sm text-center py-4">No pending receivables</p>
          ) : (
            <div className="space-y-2">
              {pendingReceivable.map((inv, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm font-medium">{inv.vendor}</p>
                    {inv.due_date && <p className="text-white/30 text-xs font-mono">Due {formatDate(inv.due_date)}</p>}
                  </div>
                  <span className="font-mono text-sm text-green-400">{formatINR(inv.amount, true)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
