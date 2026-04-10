"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { getCurrentFY, getGSTDueDate, cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transactions": "Transactions",
  "/invoices": "Invoices & Docs",
  "/subscriptions": "Subscriptions",
  "/pl": "P&L Statement",
  "/cashflow": "Cash Flow",
  "/budget": "Budget vs Actual",
  "/tax": "Tax & GST",
  "/ai": "AI Advisor",
  "/settings": "Settings",
  "/audit": "Audit Log",
  "/store-analytics": "Store Analytics",
  "/ads": "Ad Performance",
  "/payments-hub": "Payments Hub",
  "/traffic": "Traffic & Conversions",
  "/bank-statements": "Bank Statements",
  "/goals": "Goals & OKRs",
  "/scenarios": "What-If Scenarios",
  "/forecast": "Revenue Forecast",
  "/reports": "Reports Hub",
  "/briefing": "AI Briefing",
};

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

export function Header() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "TKOA Finance";
  const fy = getCurrentFY();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setShowAlerts(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchAlerts() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch { /* non-blocking */ }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "alert", mark_read: true }),
    });
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  }

  const unreadCount = alerts.filter(a => !a.is_read).length;

  const severityColor = (s: string) =>
    s === "critical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
    s === "warning" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
    "bg-blue-500/10 text-blue-400 border-blue-500/20";

  const severityDot = (s: string) =>
    s === "critical" ? "bg-red-400" :
    s === "warning" ? "bg-orange-400" :
    "bg-blue-400";

  return (
    <header className="h-12 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[#060608]/80 backdrop-blur-sm sticky top-0 z-10">
      {/* Left: Page title */}
      <div className="flex items-center gap-3">
        <h1 className="font-heading font-semibold text-white/90 text-sm">{title}</h1>
        <span className="font-mono text-[10px] text-white/20 hidden sm:block">{fy}</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Quick Add */}
        <Link
          href="/transactions?add=true"
          className="btn-primary py-1 px-2.5 text-xs hidden sm:inline-flex"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </Link>

        {/* Upload Invoice */}
        <Link
          href="/invoices?upload=true"
          className="btn-ghost py-1 px-2.5 text-xs hidden sm:inline-flex"
          title="Upload Invoice"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </Link>

        {/* Sync All */}
        <SyncButton />

        {/* Alerts bell */}
        <div ref={alertRef} className="relative">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all cursor-pointer"
            title="Alerts"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#DC3C3C] text-[7px] flex items-center justify-center font-bold" />
            )}
          </button>

          {/* Alert dropdown */}
          {showAlerts && (
            <div className="absolute right-0 top-10 w-80 bg-[#111118] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <span className="text-white/70 text-xs font-semibold">
                  Alerts {unreadCount > 0 && <span className="text-[#DC3C3C]">({unreadCount} new)</span>}
                </span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-white/30 hover:text-white/50 text-xs transition-colors">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {alerts.length === 0 ? (
                  <p className="text-white/20 text-xs text-center py-6">No alerts</p>
                ) : (
                  alerts.slice(0, 10).map(alert => (
                    <div key={alert.id} className={cn("px-4 py-3 border-b border-white/[0.04] transition-colors", !alert.is_read && "bg-white/[0.02]")}>
                      <div className="flex items-start gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", severityDot(alert.severity))} />
                        <div className="min-w-0">
                          <p className="text-white/80 text-xs font-medium truncate">{alert.title}</p>
                          <p className="text-white/40 text-[10px] mt-0.5 leading-snug">{alert.description.slice(0, 80)}...</p>
                          <span className={cn("inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] border", severityColor(alert.severity))}>
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2 border-t border-white/[0.06]">
                <Link href="/dashboard" onClick={() => setShowAlerts(false)} className="text-xs text-white/30 hover:text-white/50 transition-colors">
                  View all →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* AI Advisor shortcut */}
        <Link
          href="/ai"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all cursor-pointer"
          title="AI Advisor"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Link>

        {/* GST reminder badge */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 cursor-default"
          title={`GST due: ${getGSTDueDate()}`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          <span className="text-yellow-400 text-[10px] font-medium font-mono">GST {getGSTDueDate()}</span>
        </div>
      </div>
    </header>
  );
}

function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  async function syncAll() {
    setSyncing(true);
    try {
      await fetch("/api/sync/all", { method: "POST" });
      setSynced(true);
      setTimeout(() => setSynced(false), 3000);
    } catch { /* non-blocking */ }
    setSyncing(false);
  }

  return (
    <button
      onClick={syncAll}
      disabled={syncing}
      title="Sync all data sources"
      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-50"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={synced ? "#22c55e" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        className={cn(syncing && "animate-spin")}>
        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  );
}
