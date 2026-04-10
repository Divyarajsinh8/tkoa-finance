"use client";

import { formatINR, getCurrentQuarter, getGSTDueDate, cn } from "@/lib/utils";

interface Txn {
  type: string;
  category: string;
  vendor: string;
  amount: number;
  gst_amount: number;
  gst_rate: number;
  date: string;
  status: string;
}

interface Props {
  quarterTxns: Txn[];
  invoicesNoGST: { vendor: string; amount: number; vendor_gstin: string | null }[];
  quarterStart: string;
}

export function TaxClient({ quarterTxns, invoicesNoGST, quarterStart }: Props) {
  const quarter = getCurrentQuarter();
  const dueDate = getGSTDueDate();

  const outputGST = quarterTxns.filter(t => t.type === "income").reduce((s, t) => s + (t.gst_amount ?? 0), 0);
  const inputGST = quarterTxns.filter(t => t.type === "expense").reduce((s, t) => s + (t.gst_amount ?? 0), 0);
  const netGST = outputGST - inputGST;

  // Group by GST rate
  const byRate = quarterTxns.reduce((acc: Record<number, { output: number; input: number }>, t) => {
    const rate = t.gst_rate ?? 0;
    if (!acc[rate]) acc[rate] = { output: 0, input: 0 };
    if (t.type === "income") acc[rate].output += t.gst_amount ?? 0;
    else acc[rate].input += t.gst_amount ?? 0;
    return acc;
  }, {});

  return (
    <div className="max-w-4xl space-y-5">
      {/* Quarter Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title text-xl">Tax & GST</h2>
          <p className="text-white/40 text-sm mt-0.5">
            {quarter} · Quarter from {quarterStart} · Filing due {dueDate}
          </p>
        </div>
        <button className="btn-ghost py-1.5 px-3 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export GSTR-3B
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="metric-card">
          <p className="data-label mb-2">Output GST (Collected)</p>
          <p className="font-heading font-bold text-2xl text-green-400">{formatINR(outputGST, true)}</p>
          <p className="font-mono text-xs text-white/30 mt-1">from income transactions</p>
        </div>
        <div className="metric-card">
          <p className="data-label mb-2">Input Tax Credit</p>
          <p className="font-heading font-bold text-2xl text-blue-400">{formatINR(inputGST, true)}</p>
          <p className="font-mono text-xs text-white/30 mt-1">from expense transactions</p>
        </div>
        <div className="metric-card">
          <p className="data-label mb-2">Net GST Payable</p>
          <p className={cn("font-heading font-bold text-2xl", netGST >= 0 ? "text-red-400" : "text-green-400")}>
            {netGST >= 0 ? formatINR(netGST, true) : `-${formatINR(Math.abs(netGST), true)}`}
          </p>
          <p className="font-mono text-xs text-white/30 mt-1">due {dueDate}</p>
        </div>
      </div>

      {/* By GST Rate */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">Breakdown by GST Rate</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.05]">
              <th className="text-left pb-2 data-label">GST Rate</th>
              <th className="text-right pb-2 data-label">Output GST</th>
              <th className="text-right pb-2 data-label">Input GST (ITC)</th>
              <th className="text-right pb-2 data-label">Net Payable</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byRate).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, val]) => (
              <tr key={rate} className="border-b border-white/[0.03]">
                <td className="py-2.5 font-mono">{rate}%</td>
                <td className="py-2.5 text-right font-mono text-green-400">{formatINR(val.output, true)}</td>
                <td className="py-2.5 text-right font-mono text-blue-400">{formatINR(val.input, true)}</td>
                <td className={cn("py-2.5 text-right font-mono", val.output - val.input >= 0 ? "text-red-400" : "text-green-400")}>
                  {formatINR(val.output - val.input, true)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-white/[0.08] font-semibold">
              <td className="py-2.5 text-white/80">Total</td>
              <td className="py-2.5 text-right font-mono text-green-400">{formatINR(outputGST, true)}</td>
              <td className="py-2.5 text-right font-mono text-blue-400">{formatINR(inputGST, true)}</td>
              <td className={cn("py-2.5 text-right font-mono", netGST >= 0 ? "text-red-400" : "text-green-400")}>{formatINR(netGST, true)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Missing GSTIN Alert */}
      {invoicesNoGST.length > 0 && (
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-yellow-400 text-sm font-medium">{invoicesNoGST.length} invoices missing GSTIN</span>
          </div>
          <p className="text-white/40 text-xs">These vendors may not be GST registered. Input tax credit cannot be claimed without GSTIN.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {invoicesNoGST.slice(0, 5).map((inv, i) => (
              <span key={i} className="text-xs bg-yellow-400/10 text-yellow-400/70 px-2 py-0.5 rounded-full">{inv.vendor}</span>
            ))}
          </div>
        </div>
      )}

      {/* GSTR-3B Deadline Tracker */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">GST Filing Calendar</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["Q1 (Apr-Jun)", "Q2 (Jul-Sep)", "Q3 (Oct-Dec)", "Q4 (Jan-Mar)"].map((q, i) => {
            const currentQ = getCurrentQuarter();
            const qNum = `Q${i + 1}`;
            const isCurrentQ = currentQ === qNum;
            const year = new Date().getFullYear();
            const dueDates = [`20 Jul ${year}`, `20 Oct ${year}`, `20 Jan ${year + 1}`, `20 Apr ${year + 1}`];
            return (
              <div key={q} className={cn("rounded-xl p-3 border", isCurrentQ ? "bg-[#DC3C3C]/10 border-[#DC3C3C]/30" : "bg-white/[0.02] border-white/[0.05]")}>
                <p className={cn("text-xs font-medium mb-1", isCurrentQ ? "text-[#DC3C3C]" : "text-white/50")}>{qNum}</p>
                <p className={cn("text-[10px]", isCurrentQ ? "text-white/70" : "text-white/30")}>{q}</p>
                <p className={cn("font-mono text-[10px] mt-1.5", isCurrentQ ? "text-yellow-400" : "text-white/25")}>Due {dueDates[i]}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
