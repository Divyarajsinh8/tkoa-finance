"use client";

import { formatINR, cn } from "@/lib/utils";

const EXPENSE_CATEGORIES = [
  "Marketing", "Subscriptions", "Salaries", "Infrastructure", "Tools & Software",
  "Advertising", "Design", "Legal", "Accounting", "Office", "Travel", "Miscellaneous",
];

interface Txn {
  type: string;
  category: string;
  amount: number;
  gst_amount: number;
  date: string;
  status: string;
}

interface Props {
  transactions: Txn[];
}

export function PLClient({ transactions }: Props) {
  const now = new Date();

  // Build 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    };
  });

  function monthTxns(monthKey: string, type: string, category?: string) {
    return transactions.filter(t => {
      if (!t.date.startsWith(monthKey)) return false;
      if (t.type !== type) return false;
      if (category && t.category !== category) return false;
      return true;
    }).reduce((s, t) => s + t.amount, 0);
  }

  const rows = [
    { label: "Revenue", isTotal: false, getValue: (m: string) => monthTxns(m, "income"), className: "text-green-400" },
    { label: "— Shopify Sales", isTotal: false, indent: true, getValue: (m: string) => monthTxns(m, "income", "Shopify Revenue"), className: "text-white/60" },
    { label: "Gross Profit", isTotal: true, getValue: (m: string) => monthTxns(m, "income"), className: "text-green-400 font-semibold" },
    { label: "Operating Expenses", isTotal: false, getValue: () => 0, className: "text-white/50 font-medium" },
    ...EXPENSE_CATEGORIES.map(cat => ({
      label: `— ${cat}`,
      isTotal: false,
      indent: true,
      getValue: (m: string) => monthTxns(m, "expense", cat),
      className: "text-white/50",
    })),
    {
      label: "Total Expenses",
      isTotal: true,
      getValue: (m: string) => monthTxns(m, "expense"),
      className: "text-red-400 font-semibold",
    },
    {
      label: "Net Profit",
      isTotal: true,
      getValue: (m: string) => monthTxns(m, "income") - monthTxns(m, "expense"),
      isNetProfit: true,
      className: "",
    },
  ];

  return (
    <div className="max-w-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="page-title text-xl">Profit & Loss Statement</h2>
        <button className="btn-ghost py-1.5 px-3 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export
        </button>
      </div>

      <div className="card-base overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 data-label w-48">Category</th>
              {months.map(m => (
                <th key={m.key} className="text-right px-4 py-3 data-label font-mono">{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const values = months.map(m => row.getValue(m.key));
              const hasValues = values.some(v => v !== 0);

              if (!hasValues && (row as { indent?: boolean }).indent) return null;

              return (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-white/[0.03]",
                    row.isTotal ? "bg-white/[0.02]" : "hover:bg-white/[0.01] transition-colors",
                    (row as { isNetProfit?: boolean }).isNetProfit ? "border-t border-white/[0.08]" : ""
                  )}
                >
                  <td className={cn("px-4 py-2.5", (row as { indent?: boolean }).indent ? "pl-7" : "", row.isTotal ? "font-medium text-white/80" : "")}>
                    {row.label}
                  </td>
                  {values.map((val, j) => {
                    const isNetProfit = (row as { isNetProfit?: boolean }).isNetProfit;
                    const color = isNetProfit
                      ? val >= 0 ? "text-green-400" : "text-red-400"
                      : row.className;

                    return (
                      <td key={j} className={cn("px-4 py-2.5 text-right font-mono", color)}>
                        {val === 0 ? (row.isTotal || isNetProfit ? formatINR(0, true) : "—") : formatINR(val, true)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Margin row */}
            <tr className="bg-white/[0.02] border-t border-white/[0.06]">
              <td className="px-4 py-2.5 data-label">Net Margin</td>
              {months.map(m => {
                const rev = monthTxns(m.key, "income");
                const profit = rev - monthTxns(m.key, "expense");
                const margin = rev > 0 ? (profit / rev) * 100 : 0;
                return (
                  <td key={m.key} className={cn("px-4 py-2.5 text-right font-mono text-xs", margin >= 0 ? "text-green-400" : "text-red-400")}>
                    {margin.toFixed(1)}%
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
