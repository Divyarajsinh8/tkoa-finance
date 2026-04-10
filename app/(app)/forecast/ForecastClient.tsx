"use client";

import { useState, useMemo } from "react";
import { formatINR, cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AiForecast {
  id: string;
  metric: string;
  period: string;
  forecast_date: string;
  optimistic: number;
  expected: number;
  pessimistic: number;
  assumptions: { growth_rate: string; key_drivers: string; risks: string };
  created_at: string;
}

interface HistoryRow {
  total_amount: number;
  created_at: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a24",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

export function ForecastClient({ forecasts, history }: { forecasts: AiForecast[]; history: HistoryRow[] }) {
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");

  // Build monthly historical chart data
  const monthlyHistory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of history) {
      const month = o.created_at.slice(0, 7);
      map[month] = (map[month] || 0) + o.total_amount;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        revenue: revenue / 100,
        type: "actual",
      }));
  }, [history]);

  // Latest revenue forecasts
  const revForecasts = forecasts
    .filter(f => f.metric === "revenue")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const forecastByPeriod = Object.fromEntries(
    revForecasts.map(f => [f.period, f])
  );

  async function generateForecast() {
    setGenerating(true);
    setGenMsg("");
    try {
      const res = await fetch("/api/ai/forecast", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setGenMsg(`Forecast generated! Refresh to see it.`);
      } else {
        setGenMsg(`Error: ${data.error}`);
      }
    } catch {
      setGenMsg("Failed to generate forecast.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-heading font-bold text-xl">Revenue Forecast</h1>
          <p className="text-white/40 text-sm mt-0.5">AI-powered 30/60/90-day projections based on your data</p>
        </div>
        <button
          onClick={generateForecast}
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
          {generating ? "Generating..." : "Generate Forecast"}
        </button>
      </div>

      {genMsg && (
        <div className={cn("px-4 py-2 rounded-lg text-sm border", genMsg.includes("Error") || genMsg.includes("Failed") ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20")}>
          {genMsg}
        </div>
      )}

      {/* Historical chart */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">Historical Revenue (6 Months)</h3>
        {monthlyHistory.length === 0 ? (
          <p className="text-white/20 text-sm text-center py-8">No historical data — sync Shopify first</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyHistory}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC3C3C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#DC3C3C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${v >= 100000 ? (v / 100000).toFixed(1) + "L" : (v / 1000).toFixed(0) + "k"}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#DC3C3C" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Forecast cards */}
      {revForecasts.length === 0 ? (
        <div className="card-base p-10 text-center">
          <p className="text-white/40 text-sm">No forecasts generated yet</p>
          <p className="text-white/20 text-xs mt-1">Click Generate Forecast to create AI-powered projections</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["30d", "60d", "90d"] as const).map(period => {
            const f = forecastByPeriod[period];
            if (!f) return (
              <div key={period} className="card-base p-5 text-center">
                <p className="text-white/20 text-sm">{period} forecast pending</p>
              </div>
            );

            const label = { "30d": "30-Day", "60d": "60-Day", "90d": "90-Day" }[period];

            return (
              <div key={period} className="card-base p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white/60 text-sm font-medium">{label} Forecast</h3>
                  <span className="text-white/20 text-[10px] font-mono">Revenue</span>
                </div>

                {/* Scenarios */}
                <div className="space-y-3">
                  {[
                    { label: "Optimistic", value: f.optimistic, color: "text-green-400", bar: "bg-green-500" },
                    { label: "Expected", value: f.expected, color: "text-blue-400", bar: "bg-blue-500" },
                    { label: "Pessimistic", value: f.pessimistic, color: "text-orange-400", bar: "bg-orange-400" },
                  ].map(scenario => {
                    const pct = f.optimistic > 0 ? (scenario.value / f.optimistic) * 100 : 0;
                    return (
                      <div key={scenario.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/40 text-xs">{scenario.label}</span>
                          <span className={cn("font-mono text-sm font-bold", scenario.color)}>
                            {formatINR(scenario.value, true)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", scenario.bar)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Assumptions */}
                {f.assumptions && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06]">
                    <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wider mb-2">Assumptions</p>
                    {f.assumptions.growth_rate && (
                      <p className="text-white/40 text-xs">Growth: <span className="text-white/60">{f.assumptions.growth_rate}</span></p>
                    )}
                    {f.assumptions.key_drivers && (
                      <p className="text-white/40 text-xs mt-1">{f.assumptions.key_drivers}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Last updated */}
      {revForecasts[0] && (
        <p className="text-white/20 text-xs text-right">
          Last generated: {new Date(revForecasts[0].created_at).toLocaleDateString("en-IN")}
          {" · Updates weekly (Monday)"}
        </p>
      )}
    </div>
  );
}
