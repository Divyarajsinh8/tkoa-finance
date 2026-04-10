"use client";

import { useState } from "react";
import { formatINR, cn } from "@/lib/utils";

const EXAMPLE_SCENARIOS = [
  "What if I increase Meta ad spend by 50%?",
  "What if I launch TheKnockoutAcademy at ₹69/month and get 30 subscribers?",
  "What if I hire a full-time developer at ₹80,000/month?",
  "What happens to profit if I cancel HeyGen (₹4,900/month)?",
  "What if I add a ₹149/month subscription tier and convert 10% of existing customers?",
  "What if Shopify fees increase by 15%?",
];

interface ScenarioResult {
  scenario_summary: string;
  monthly_impact: {
    revenue_change: number;
    expense_change: number;
    profit_change: number;
    new_monthly_revenue: number;
    new_monthly_expenses: number;
    new_monthly_profit: number;
  };
  timeline: { month: string; revenue: number; expenses: number; profit: number; note: string }[];
  break_even: string | null;
  key_assumptions: string[];
  risks: string[];
  recommendation: string;
}

export function ScenarioClient() {
  const [scenario, setScenario] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState("");

  async function runScenario() {
    if (!scenario.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ai/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to model scenario");
    } finally {
      setLoading(false);
    }
  }

  const profitColor = (val: number) => val >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-white font-heading font-bold text-xl">What-If Scenarios</h1>
        <p className="text-white/40 text-sm mt-0.5">AI financial modeling — ask any business question</p>
      </div>

      {/* Input */}
      <div className="card-base p-5">
        <label className="data-label mb-2 block">Describe your scenario</label>
        <textarea
          rows={3}
          value={scenario}
          onChange={e => setScenario(e.target.value)}
          placeholder="What if I increase ad spend by 50%? What happens to profit if I hire a developer at ₹80K/month?"
          className="input-base w-full resize-none"
        />

        <div className="flex flex-wrap gap-2 mt-3 mb-4">
          {EXAMPLE_SCENARIOS.map(s => (
            <button
              key={s}
              onClick={() => setScenario(s)}
              className="text-xs px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 rounded-md border border-white/[0.06] transition-all"
            >
              {s.slice(0, 40)}...
            </button>
          ))}
        </div>

        <button
          onClick={runScenario}
          disabled={loading || !scenario.trim()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Modeling scenario...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Run Scenario
            </>
          )}
        </button>

        {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className={cn("card-base p-5 border", result.recommendation.toLowerCase().startsWith("go") ? "border-green-500/20" : result.recommendation.toLowerCase().startsWith("no") ? "border-red-500/20" : "border-orange-500/20")}>
            <p className="text-white/50 text-xs mb-1">Scenario Analysis</p>
            <p className="text-white/80 text-sm">{result.scenario_summary}</p>
            <div className="mt-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <p className="text-white/40 text-xs mb-0.5">AI Recommendation</p>
              <p className={cn("text-sm font-semibold",
                result.recommendation.toLowerCase().startsWith("go") ? "text-green-400" :
                result.recommendation.toLowerCase().startsWith("no") ? "text-red-400" :
                "text-orange-400"
              )}>{result.recommendation}</p>
            </div>
          </div>

          {/* Monthly impact */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Revenue Impact", value: result.monthly_impact.revenue_change, new: result.monthly_impact.new_monthly_revenue },
              { label: "Expense Impact", value: result.monthly_impact.expense_change, new: result.monthly_impact.new_monthly_expenses },
              { label: "Profit Impact", value: result.monthly_impact.profit_change, new: result.monthly_impact.new_monthly_profit },
            ].map(item => (
              <div key={item.label} className="card-base p-4">
                <p className="text-white/40 text-xs mb-2">{item.label}</p>
                <p className={cn("font-mono font-bold text-lg", profitColor(item.value))}>
                  {item.value >= 0 ? "+" : ""}{formatINR(item.value, true)}
                </p>
                <p className="text-white/30 text-xs mt-1">New total: {formatINR(item.new, true)}</p>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="card-base p-5">
            <h3 className="section-title mb-4">Projected Timeline</h3>
            <div className="grid grid-cols-3 gap-3">
              {result.timeline.map(t => (
                <div key={t.month} className="bg-white/[0.03] rounded-lg p-3">
                  <p className="text-white/50 text-xs font-medium mb-2">{t.month}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/30">Revenue</span>
                      <span className="text-green-400 font-mono">{formatINR(t.revenue, true)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">Expenses</span>
                      <span className="text-red-400 font-mono">{formatINR(t.expenses, true)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/[0.06] pt-1 mt-1">
                      <span className="text-white/50">Profit</span>
                      <span className={cn("font-mono font-bold", profitColor(t.profit))}>{formatINR(t.profit, true)}</span>
                    </div>
                  </div>
                  {t.note && <p className="text-white/20 text-[10px] mt-2">{t.note}</p>}
                </div>
              ))}
            </div>
            {result.break_even && (
              <p className="mt-3 text-sm text-white/50">
                Break-even: <span className="text-blue-400 font-medium">{result.break_even}</span>
              </p>
            )}
          </div>

          {/* Assumptions + Risks */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card-base p-4">
              <h4 className="text-white/60 text-xs font-semibold mb-3">Assumptions</h4>
              <ul className="space-y-1.5">
                {result.key_assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <span className="text-blue-400 mt-0.5 shrink-0">·</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-base p-4">
              <h4 className="text-white/60 text-xs font-semibold mb-3">Risks</h4>
              <ul className="space-y-1.5">
                {result.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                    <span className="text-orange-400 mt-0.5 shrink-0">⚠</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
