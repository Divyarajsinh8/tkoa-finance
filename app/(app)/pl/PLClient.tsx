"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { formatINR, cn } from "@/lib/utils";

// Lazy-load the PDF export button (avoids SSR issues with @react-pdf/renderer)
const PLExportButton = dynamic(() => import("./PLExportButton"), { ssr: false });

const EXPENSE_CATEGORIES = [
  "Marketing",
  "Subscriptions",
  "Salaries",
  "Infrastructure",
  "Tools & Software",
  "Advertising",
  "Design",
  "Legal",
  "Accounting",
  "Office",
  "Travel",
  "Miscellaneous",
];

interface Txn {
  type: string;
  category: string;
  amount: number;
  gst_amount: number;
  date: string;
  status: string;
}

interface ShopifyOrder {
  total_amount: number;
  created_at: string;
  payment_status: string;
  store: string;
}

interface MetaAd {
  date: string;
  spend: number;
  campaign_name: string;
}

interface Props {
  transactions: Txn[];
  shopifyOrders: ShopifyOrder[];
  metaAds: MetaAd[];
}

type ViewMode = "monthly" | "quarterly" | "annual";

export function PLClient({ transactions, shopifyOrders, metaAds }: Props) {
  const [view, setView] = useState<ViewMode>("monthly");

  const now = new Date();

  // ── Build 6 monthly columns ──────────────────────────────────────────────
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    };
  });

  // ── Build 2 quarterly columns ─────────────────────────────────────────────
  const quarters = Array.from({ length: 2 }, (_, i) => {
    const monthOffset = (1 - i) * 3;
    const midMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const q = Math.floor(((midMonth.getMonth() + 9) % 12) / 3) + 1; // Indian FY quarters
    const fy = midMonth.getMonth() >= 3
      ? midMonth.getFullYear()
      : midMonth.getFullYear() - 1;
    const startMonth = ((q - 1) * 3 + 3) % 12; // Apr=3, Jul=6, Oct=9, Jan=0
    const keys: string[] = [];
    for (let m = 0; m < 3; m++) {
      const md = new Date(fy, startMonth + m, 1);
      keys.push(`${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, "0")}`);
    }
    return { key: `Q${q} FY${String(fy + 1).slice(2)}`, label: `Q${q} FY${String(fy + 1).slice(2)}`, monthKeys: keys };
  }).reverse();

  // ── Current FY column ─────────────────────────────────────────────────────
  const fyStartMonth = now.getMonth() >= 3 ? 3 : 3;
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyMonthKeys: string[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(fyStartYear, fyStartMonth + m, 1);
    fyMonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const annualCols = [{ key: "FY", label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`, monthKeys: fyMonthKeys }];

  // ── Aggregation helpers ───────────────────────────────────────────────────
  function txnSum(monthKeys: string[], type: string, category?: string): number {
    return transactions
      .filter(t => {
        const mk = t.date.slice(0, 7);
        if (!monthKeys.includes(mk)) return false;
        if (t.type !== type) return false;
        if (category && t.category !== category) return false;
        return true;
      })
      .reduce((s, t) => s + t.amount, 0);
  }

  function shopifySum(monthKeys: string[]): number {
    return shopifyOrders
      .filter(o => monthKeys.includes(o.created_at.slice(0, 7)))
      .reduce((s, o) => s + o.total_amount, 0);
  }

  function metaSum(monthKeys: string[]): number {
    return metaAds
      .filter(a => monthKeys.includes(a.date.slice(0, 7)))
      .reduce((s, a) => s + a.spend, 0);
  }

  // ── Columns for each view ─────────────────────────────────────────────────
  const cols =
    view === "monthly"
      ? months.map(m => ({ ...m, monthKeys: [m.key] }))
      : view === "quarterly"
      ? quarters
      : annualCols;

  // ── Row definitions ───────────────────────────────────────────────────────
  interface Row {
    label: string;
    indent?: boolean;
    isSection?: boolean;
    isTotal?: boolean;
    isNetProfit?: boolean;
    className?: string;
    getValue: (mks: string[]) => number;
    isZeroable?: boolean;
  }

  const rows: Row[] = [
    {
      label: "Gross Revenue",
      getValue: mks => txnSum(mks, "income") + shopifySum(mks),
      className: "text-green-400",
    },
    {
      label: "— Shopify Sales (live)",
      indent: true,
      getValue: mks => shopifySum(mks),
      className: "text-green-300/60",
      isZeroable: true,
    },
    {
      label: "— Other Income",
      indent: true,
      getValue: mks => txnSum(mks, "income"),
      className: "text-green-300/60",
      isZeroable: true,
    },
    {
      label: "Gross Profit",
      isTotal: true,
      getValue: mks => txnSum(mks, "income") + shopifySum(mks),
      className: "text-green-400 font-semibold",
    },
    {
      label: "Operating Expenses",
      isSection: true,
      getValue: () => 0,
      className: "text-white/40",
    },
    ...EXPENSE_CATEGORIES.map(cat => ({
      label: `— ${cat}`,
      indent: true,
      getValue: (mks: string[]) => {
        const base = txnSum(mks, "expense", cat);
        // Overlay Meta Ads spend into Advertising category
        if (cat === "Advertising") return base + metaSum(mks);
        return base;
      },
      className: "text-white/50",
      isZeroable: true,
    })),
    {
      label: "Total Expenses",
      isTotal: true,
      getValue: mks => txnSum(mks, "expense") + metaSum(mks),
      className: "text-red-400 font-semibold",
    },
    {
      label: "Net Profit",
      isTotal: true,
      isNetProfit: true,
      getValue: mks => txnSum(mks, "income") + shopifySum(mks) - txnSum(mks, "expense") - metaSum(mks),
      className: "",
    },
  ];

  // ── Build table data ──────────────────────────────────────────────────────
  const tableRows = rows.map(row => ({
    ...row,
    values: cols.map(c => row.getValue(c.monthKeys)),
  }));

  // ── Snapshot data for PDF export ──────────────────────────────────────────
  const exportData = {
    cols,
    rows: tableRows.map(r => ({ label: r.label, values: r.values, isTotal: r.isTotal, isNetProfit: r.isNetProfit, indent: r.indent, isSection: r.isSection })),
    generatedAt: new Date().toLocaleDateString("en-IN", { dateStyle: "long" }),
  };

  return (
    <div className="max-w-full space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title text-xl">Profit & Loss Statement</h2>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex bg-white/[0.04] rounded-lg p-0.5 text-xs">
            {(["monthly", "quarterly", "annual"] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium capitalize transition-all cursor-pointer",
                  view === v
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* PDF Export */}
          <PLExportButton data={exportData} />
        </div>
      </div>

      {/* Live data indicators */}
      <div className="flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1.5 text-green-400/70">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Shopify orders (live)
        </span>
        <span className="flex items-center gap-1.5 text-blue-400/70">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Meta Ads spend (live)
        </span>
      </div>

      {/* P&L Table */}
      <div className="card-base overflow-x-auto">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 data-label w-52">Category</th>
              {cols.map(c => (
                <th key={c.key} className="text-right px-4 py-3 data-label font-mono">
                  {c.label}
                </th>
              ))}
              {cols.length > 1 && (
                <th className="text-right px-4 py-3 data-label font-mono text-white/20">Total</th>
              )}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => {
              if (row.isZeroable && row.values.every(v => v === 0)) return null;

              const rowTotal = row.values.reduce((s, v) => s + v, 0);

              return (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-white/[0.03]",
                    row.isSection ? "bg-transparent" : "",
                    row.isTotal ? "bg-white/[0.02]" : "hover:bg-white/[0.01] transition-colors",
                    row.isNetProfit ? "border-t border-white/[0.08]" : ""
                  )}
                >
                  <td
                    className={cn(
                      "px-4 py-2.5",
                      row.indent ? "pl-8" : "",
                      row.isTotal ? "font-medium text-white/80" : "",
                      row.isSection ? "text-white/30 text-[10px] uppercase tracking-widest pt-4 pb-1" : "",
                    )}
                  >
                    {row.label}
                  </td>

                  {row.values.map((val, j) => {
                    if (row.isSection) return <td key={j} />;
                    const color = row.isNetProfit
                      ? val >= 0 ? "text-green-400" : "text-red-400"
                      : row.className;

                    return (
                      <td key={j} className={cn("px-4 py-2.5 text-right font-mono", color)}>
                        {val === 0
                          ? row.isTotal || row.isNetProfit ? formatINR(0, true) : "—"
                          : formatINR(val, true)}
                      </td>
                    );
                  })}

                  {/* Totals column */}
                  {cols.length > 1 && !row.isSection && (
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-mono text-white/25",
                        row.isNetProfit ? (rowTotal >= 0 ? "text-green-400/50" : "text-red-400/50") : ""
                      )}
                    >
                      {rowTotal === 0 ? "—" : formatINR(rowTotal, true)}
                    </td>
                  )}
                  {row.isSection && cols.length > 1 && <td />}
                </tr>
              );
            })}

            {/* Net Margin row */}
            <tr className="bg-white/[0.02] border-t border-white/[0.06]">
              <td className="px-4 py-2.5 data-label">Net Margin</td>
              {cols.map(c => {
                const rev = txnSum(c.monthKeys, "income") + shopifySum(c.monthKeys);
                const exp = txnSum(c.monthKeys, "expense") + metaSum(c.monthKeys);
                const margin = rev > 0 ? ((rev - exp) / rev) * 100 : 0;
                return (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-2.5 text-right font-mono",
                      margin >= 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {margin.toFixed(1)}%
                  </td>
                );
              })}
              {cols.length > 1 && <td />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
