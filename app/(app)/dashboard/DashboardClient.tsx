"use client";

import { MetricCard } from "@/components/dashboard/MetricCard";
import { BarChart } from "@/components/dashboard/BarChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { formatINR, formatDate, statusColor, percentChange, generateSparkline } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Transaction, Invoice } from "@/types";

interface Props {
  currentMonthTxns: Transaction[];
  lastMonthTxns: Transaction[];
  chartTxns: Pick<Transaction, "type" | "amount" | "date" | "category">[];
  pendingPayable: Pick<Invoice, "amount" | "vendor" | "due_date">[];
  pendingReceivable: Pick<Invoice, "amount" | "vendor" | "due_date">[];
  recentTxns: Transaction[];
  quarterTxns: Pick<Transaction, "type" | "gst_amount">[];
}

export function DashboardClient({
  currentMonthTxns,
  lastMonthTxns,
  chartTxns,
  pendingPayable,
  pendingReceivable,
  recentTxns,
  quarterTxns,
}: Props) {
  // Calculate metrics
  const currentRevenue = currentMonthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const currentExpenses = currentMonthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const currentProfit = currentRevenue - currentExpenses;
  const netMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

  const lastRevenue = lastMonthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const lastExpenses = lastMonthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const revenueChange = percentChange(currentRevenue, lastRevenue);
  const expenseChange = percentChange(currentExpenses, lastExpenses);
  const profitChange = percentChange(currentProfit, lastRevenue - lastExpenses);

  const totalPayable = pendingPayable.reduce((s, i) => s + i.amount, 0);
  const totalReceivable = pendingReceivable.reduce((s, i) => s + i.amount, 0);

  // GST calculation
  const outputGST = quarterTxns.filter(t => t.type === "income").reduce((s, t) => s + (t.gst_amount ?? 0), 0);
  const inputGST = quarterTxns.filter(t => t.type === "expense").reduce((s, t) => s + (t.gst_amount ?? 0), 0);
  const netGST = outputGST - inputGST;

  // Monthly burn (expenses)
  const monthlyBurn = currentExpenses;
  const cashRunway = monthlyBurn > 0 ? Math.round((currentRevenue * 3) / monthlyBurn) : 99;

  // Build chart data - last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short" });
    const monthTxns = chartTxns.filter(t => t.date.startsWith(month));
    return {
      month: label,
      revenue: monthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expenses: monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    };
  });

  // Expense breakdown by category
  const expenseByCategory = currentMonthTxns
    .filter(t => t.type === "expense")
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});

  const donutData = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }));

  return (
    <div className="space-y-5 max-w-7xl">
      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Revenue"
          value={formatINR(currentRevenue, true)}
          subValue="this month"
          change={revenueChange}
          sparkData={generateSparkline(currentRevenue)}
          sparkColor="#22c55e"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
          }
        />
        <MetricCard
          label="Expenses"
          value={formatINR(currentExpenses, true)}
          subValue="this month"
          change={expenseChange}
          sparkData={generateSparkline(currentExpenses)}
          sparkColor="#DC3C3C"
          trend={expenseChange >= 0 ? "down" : "up"}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
            </svg>
          }
        />
        <MetricCard
          label="Net Profit"
          value={formatINR(currentProfit, true)}
          subValue={`${netMargin.toFixed(1)}% margin`}
          change={profitChange}
          sparkData={generateSparkline(Math.max(currentProfit, 0))}
          sparkColor={currentProfit >= 0 ? "#22c55e" : "#DC3C3C"}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <MetricCard
          label="Cash Runway"
          value={`${cashRunway}mo`}
          subValue="at current burn"
          trend="neutral"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
        />
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Payable"
          value={formatINR(totalPayable, true)}
          subValue={`${pendingPayable.length} invoices`}
          trend={totalPayable > 0 ? "down" : "neutral"}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
        />
        <MetricCard
          label="Receivable"
          value={formatINR(totalReceivable, true)}
          subValue={`${pendingReceivable.length} pending`}
          trend={totalReceivable > 0 ? "up" : "neutral"}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
        <MetricCard
          label="GST Due"
          value={formatINR(Math.max(netGST, 0), true)}
          subValue="this quarter"
          trend="neutral"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        />
        <MetricCard
          label="Monthly Burn"
          value={formatINR(monthlyBurn, true)}
          subValue="total expenses"
          trend="neutral"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M12 6v6l4 2" />
            </svg>
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Expenses Chart */}
        <div className="lg:col-span-2 card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Revenue vs Expenses</h3>
            <span className="font-mono text-xs text-white/30">Last 6 months</span>
          </div>
          <BarChart data={chartData} />
        </div>

        {/* Expense Breakdown */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Expense Split</h3>
            <span className="font-mono text-xs text-white/30">This month</span>
          </div>
          {donutData.length > 0 ? (
            <DonutChart data={donutData} />
          ) : (
            <div className="h-[140px] flex items-center justify-center text-white/20 text-sm">
              No expenses recorded
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: AP/AR + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Accounts Payable */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title text-sm">Accounts Payable</h3>
            <span className="font-mono text-xs text-red-400/70">{formatINR(totalPayable, true)}</span>
          </div>
          <div className="space-y-2">
            {pendingPayable.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-4">All clear</p>
            ) : (
              pendingPayable.slice(0, 4).map((inv, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-xs font-medium">{inv.vendor}</p>
                    {inv.due_date && <p className="text-white/30 text-[10px] font-mono">Due {formatDate(inv.due_date)}</p>}
                  </div>
                  <span className="font-mono text-xs text-red-400">{formatINR(inv.amount, true)}</span>
                </div>
              ))
            )}
          </div>
          <Link href="/invoices" className="block mt-3 text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer">
            View all invoices →
          </Link>
        </div>

        {/* Accounts Receivable */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title text-sm">Accounts Receivable</h3>
            <span className="font-mono text-xs text-green-400/70">{formatINR(totalReceivable, true)}</span>
          </div>
          <div className="space-y-2">
            {pendingReceivable.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-4">No pending receivables</p>
            ) : (
              pendingReceivable.slice(0, 4).map((inv, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-xs font-medium">{inv.vendor}</p>
                    {inv.due_date && <p className="text-white/30 text-[10px] font-mono">Due {formatDate(inv.due_date)}</p>}
                  </div>
                  <span className="font-mono text-xs text-green-400">{formatINR(inv.amount, true)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title text-sm">Recent Transactions</h3>
            <Link href="/transactions" className="text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer">View all</Link>
          </div>
          <div className="space-y-2.5">
            {recentTxns.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-4">No transactions yet</p>
            ) : (
              recentTxns.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white/80 text-xs font-medium truncate">{txn.vendor}</p>
                    <p className="text-white/30 text-[10px] font-mono">{txn.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("font-mono text-xs font-medium", txn.type === "income" ? "text-green-400" : "text-red-400")}>
                      {txn.type === "income" ? "+" : "-"}{formatINR(txn.amount, true)}
                    </p>
                    <span className={cn("status-badge text-[10px]", statusColor(txn.status))}>
                      {txn.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
