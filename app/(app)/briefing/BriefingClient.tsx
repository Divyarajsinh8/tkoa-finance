"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AiBriefing {
  id: string;
  date: string;
  content: string;
  data_snapshot: Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
}

export function BriefingClient({ briefings }: { briefings: AiBriefing[] }) {
  const [selected, setSelected] = useState(briefings[0] || null);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");

  async function generateNow() {
    setGenerating(true);
    setGenMsg("");
    try {
      const res = await fetch("/api/ai/briefing", { method: "POST" });
      const data = await res.json();
      setGenMsg(res.ok ? "Briefing generated! Refresh to read it." : `Error: ${data.error || data.message}`);
    } catch {
      setGenMsg("Failed to generate briefing.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-heading font-bold text-xl">AI Briefing</h1>
          <p className="text-white/40 text-sm mt-0.5">Daily business snapshot, delivered every morning at 8 AM IST</p>
        </div>
        <button
          onClick={generateNow}
          disabled={generating}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#DC3C3C]/10 hover:bg-[#DC3C3C]/20 text-[#DC3C3C] rounded-lg border border-[#DC3C3C]/20 transition-all disabled:opacity-50"
        >
          {generating ? (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
          {generating ? "Generating..." : "Generate Now"}
        </button>
      </div>

      {genMsg && (
        <div className={cn("px-4 py-2 rounded-lg text-sm border", genMsg.includes("Error") || genMsg.includes("Failed") ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20")}>
          {genMsg}
        </div>
      )}

      {briefings.length === 0 ? (
        <div className="card-base p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <p className="text-white/40 text-sm">No briefings yet</p>
          <p className="text-white/20 text-xs mt-1">Add ANTHROPIC_API_KEY and click Generate Now, or wait for the daily cron at 8 AM IST</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Date list */}
          <div className="space-y-1">
            {briefings.map(b => (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all",
                  selected?.id === b.id ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                )}
              >
                <p className="font-medium">{new Date(b.date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}</p>
                <p className="text-white/25 text-[10px] mt-0.5">
                  {b.sent_at ? "✓ Emailed" : "Not sent"}
                </p>
              </button>
            ))}
          </div>

          {/* Content */}
          {selected && (
            <div className="lg:col-span-3 card-base p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                  {new Date(selected.date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </h3>
                {selected.sent_at && (
                  <span className="text-green-400 text-[10px] flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Emailed
                  </span>
                )}
              </div>
              <div className="prose prose-sm max-w-none">
                <pre className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap font-sans bg-transparent p-0 border-0">
                  {selected.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
