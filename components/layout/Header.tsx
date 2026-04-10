"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { getCurrentFY, getGSTDueDate } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transactions": "Transactions",
  "/invoices": "Invoices",
  "/subscriptions": "Subscriptions",
  "/pl": "P&L Statement",
  "/cashflow": "Cash Flow",
  "/budget": "Budget vs Actual",
  "/tax": "Tax & GST",
  "/ai": "AI Advisor",
  "/settings": "Settings",
  "/audit": "Audit Log",
};

export function Header() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "TKOA Finance";
  const fy = getCurrentFY();

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[#060608]/80 backdrop-blur-sm sticky top-0 z-10">
      {/* Left: Page title */}
      <div className="flex items-center gap-3">
        <h1 className="font-heading font-semibold text-white/90 text-base">{title}</h1>
        <span className="font-mono text-xs text-white/25 hidden sm:block">{fy}</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Add */}
        <Link
          href="/transactions?add=true"
          className="btn-primary py-1.5 px-3 text-xs hidden sm:inline-flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Transaction
        </Link>

        {/* Upload Invoice */}
        <Link
          href="/invoices?upload=true"
          className="btn-ghost py-1.5 px-3 text-xs hidden sm:inline-flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </Link>

        {/* AI Advisor shortcut */}
        <Link
          href="/ai"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all duration-150 cursor-pointer"
          title="AI Advisor"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Link>

        {/* GST reminder badge */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 cursor-default"
          title={`GST due: ${getGSTDueDate()}`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          <span className="text-yellow-400 text-xs font-medium font-mono">GST {getGSTDueDate()}</span>
        </div>
      </div>
    </header>
  );
}
