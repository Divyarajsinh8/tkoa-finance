"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Briefing {
  date: string;
  content: string;
  sent_at: string | null;
}

type ReportType = "daily" | "weekly" | "monthly" | "gst";

const REPORT_TYPES: { type: ReportType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    type: "daily",
    label: "Daily Snapshot",
    description: "Yesterday's key metrics — revenue, orders, ads",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  },
  {
    type: "weekly",
    label: "Weekly Report",
    description: "Full weekly performance — revenue, ads, expenses",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  },
  {
    type: "monthly",
    label: "Monthly Report",
    description: "P&L + cash flow + growth insights for the month",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>,
  },
  {
    type: "gst",
    label: "GST Summary",
    description: "Output GST, input GST, net payable — ready for filing",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  },
];

export function ReportsClient({ briefings }: { briefings: Briefing[] }) {
  const [generating, setGenerating] = useState<ReportType | null>(null);
  const [msg, setMsg] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");

  async function generateReport(type: ReportType) {
    setGenerating(type);
    setMsg("");
    setGeneratedContent("");

    const endpoint = type === "weekly" ? "/api/ai/weekly-report" :
                     type === "daily" ? "/api/ai/briefing" :
                     null;

    if (!endpoint) {
      setMsg("This report type will be available soon.");
      setGenerating(null);
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "x-cron-secret": "", "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedContent(data.content || data.briefing?.content || "Report generated! Check your email.");
        setMsg(`${type === "weekly" ? "Weekly report" : "Daily briefing"} generated and emailed.`);
      } else {
        setMsg(`Error: ${data.error || "Unknown error"}`);
      }
    } catch {
      setMsg("Failed to generate report.");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-white font-heading font-bold text-xl">Reports Hub</h1>
        <p className="text-white/40 text-sm mt-0.5">Generate and manage all your business reports</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06] w-fit">
        {(["generate", "history"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
              activeTab === tab ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "generate" ? (
        <>
          {/* Report types */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REPORT_TYPES.map(rt => (
              <div key={rt.type} className="card-base p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 shrink-0">
                  {rt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-semibold">{rt.label}</p>
                  <p className="text-white/30 text-xs mt-0.5 mb-3">{rt.description}</p>
                  <button
                    onClick={() => generateReport(rt.type)}
                    disabled={generating === rt.type}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white/80 rounded-md border border-white/[0.06] transition-all disabled:opacity-50"
                  >
                    {generating === rt.type ? (
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                    {generating === rt.type ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {msg && (
            <div className={cn("px-4 py-3 rounded-lg text-sm border", msg.includes("Error") || msg.includes("Failed") ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20")}>
              {msg}
            </div>
          )}

          {/* Generated content preview */}
          {generatedContent && (
            <div className="card-base p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title">Generated Report</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedContent)}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {generatedContent}
              </pre>
            </div>
          )}

          {/* Schedule info */}
          <div className="card-base p-5">
            <h3 className="section-title mb-3">Automated Schedule</h3>
            <div className="space-y-2.5">
              {[
                { label: "Daily Briefing", time: "8:00 AM IST", desc: "Revenue, orders, alerts, priorities" },
                { label: "Weekly Report", time: "Monday 8:30 AM IST", desc: "Full week performance + recommendations" },
                { label: "Anomaly Check", time: "Every 6 hours", desc: "Monitors for revenue drops, ad spend spikes" },
                { label: "Revenue Forecast", time: "Monday 9:30 AM IST", desc: "Updates 30/60/90-day projections weekly" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-medium">{item.label}</p>
                    <p className="text-white/30 text-[10px]">{item.desc}</p>
                  </div>
                  <span className="text-blue-400 text-xs font-mono">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* History tab */
        <div className="space-y-3">
          {briefings.length === 0 ? (
            <div className="card-base p-8 text-center">
              <p className="text-white/30 text-sm">No reports generated yet</p>
            </div>
          ) : (
            briefings.map(b => (
              <div key={b.date} className="card-base p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white/70 text-sm font-medium">
                    {new Date(b.date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  {b.sent_at && (
                    <span className="text-green-400 text-xs">✓ Emailed</span>
                  )}
                </div>
                <pre className="text-white/40 text-xs leading-relaxed whitespace-pre-wrap font-sans line-clamp-3">
                  {b.content.slice(0, 200)}...
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
