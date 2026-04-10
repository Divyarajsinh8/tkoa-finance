"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, formatDate, cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  metric: string;
  period: string;
  period_start: string;
  period_end: string;
  target_value: number;
  current_value: number;
  status: string;
}

const METRIC_LABELS: Record<string, string> = {
  revenue: "Revenue",
  expenses: "Expenses",
  profit: "Net Profit",
  orders: "Orders",
  roas: "ROAS",
  cac: "CAC",
  new_customers: "New Customers",
};

const METRIC_FORMAT = (metric: string, val: number): string => {
  if (["revenue", "expenses", "profit", "cac"].includes(metric)) return formatINR(val, true);
  if (metric === "roas") return `${(val / 100).toFixed(2)}x`;
  return val.toString();
};

export function GoalsClient({
  goals,
  currentMetrics,
}: {
  goals: Goal[];
  currentMetrics: Record<string, number>;
}) {
  const supabase = createClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    metric: "revenue",
    period: "monthly",
    target_value: "",
    period_start: new Date().toISOString().split("T")[0],
    period_end: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  async function addGoal() {
    setSaving(true);
    const { error } = await supabase.from("goals").insert({
      title: form.title,
      metric: form.metric,
      period: form.period,
      period_start: form.period_start,
      period_end: form.period_end,
      target_value: Math.round(parseFloat(form.target_value) * 100), // paise
      current_value: currentMetrics[form.metric] || 0,
    });
    setSaving(false);
    if (!error) {
      setShowAdd(false);
      location.reload();
    }
  }

  function getProgress(goal: Goal) {
    const current = currentMetrics[goal.metric] ?? goal.current_value;
    const pct = goal.target_value > 0 ? Math.min((current / goal.target_value) * 100, 100) : 0;
    const achieved = pct >= 100;
    return { current, pct, achieved };
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-heading font-bold text-xl">Goals & OKRs</h1>
          <p className="text-white/40 text-sm mt-0.5">Track progress toward your monthly and quarterly targets</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#DC3C3C]/10 hover:bg-[#DC3C3C]/20 text-[#DC3C3C] rounded-lg border border-[#DC3C3C]/20 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Goal
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card-base p-5 border border-[#DC3C3C]/20">
          <h3 className="text-white/80 text-sm font-semibold mb-4">New Goal</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="data-label">Goal Title</label>
              <input
                className="input-base w-full mt-1"
                placeholder="e.g., Hit ₹5L monthly revenue"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="data-label">Metric</label>
              <select
                className="input-base w-full mt-1"
                value={form.metric}
                onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
              >
                {Object.entries(METRIC_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="data-label">Target (₹ or count)</label>
              <input
                type="number"
                className="input-base w-full mt-1"
                placeholder="500000"
                value={form.target_value}
                onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
              />
            </div>
            <div>
              <label className="data-label">Start Date</label>
              <input
                type="date"
                className="input-base w-full mt-1"
                value={form.period_start}
                onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
              />
            </div>
            <div>
              <label className="data-label">End Date</label>
              <input
                type="date"
                className="input-base w-full mt-1"
                value={form.period_end}
                onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addGoal} disabled={saving || !form.title || !form.target_value}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
              {saving ? "Saving..." : "Save Goal"}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-xs px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Goals */}
      {goals.length === 0 && !showAdd ? (
        <div className="card-base p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-white/40 text-sm">No goals set yet</p>
          <p className="text-white/20 text-xs mt-1">Add your first goal to track progress</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map(goal => {
            const { current, pct, achieved } = getProgress(goal);
            const daysLeft = Math.ceil((new Date(goal.period_end).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            const daysTotal = Math.ceil((new Date(goal.period_end).getTime() - new Date(goal.period_start).getTime()) / (24 * 60 * 60 * 1000));
            const timeProgress = daysTotal > 0 ? ((daysTotal - daysLeft) / daysTotal) * 100 : 0;
            const onTrack = pct >= timeProgress;

            return (
              <div
                key={goal.id}
                className={cn(
                  "card-base p-5 relative overflow-hidden",
                  achieved && "border border-green-500/20"
                )}
              >
                {achieved && (
                  <div className="absolute top-2 right-2">
                    <span className="text-green-400 text-lg">🎉</span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-white/80 text-sm font-semibold">{goal.title}</p>
                    <p className="text-white/30 text-xs mt-0.5">
                      {METRIC_LABELS[goal.metric]} · {formatDate(goal.period_start)} – {formatDate(goal.period_end)}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    achieved ? "bg-green-500/10 text-green-400" :
                    onTrack ? "bg-blue-500/10 text-blue-400" :
                    "bg-orange-500/10 text-orange-400"
                  )}>
                    {achieved ? "Achieved" : onTrack ? "On Track" : "Behind"}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-base font-bold text-white">
                      {METRIC_FORMAT(goal.metric, current)}
                    </span>
                    <span className="text-white/30 text-xs font-mono">
                      of {METRIC_FORMAT(goal.metric, goal.target_value)}
                    </span>
                  </div>
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500",
                        achieved ? "bg-green-500" : onTrack ? "bg-blue-500" : "bg-orange-400"
                      )}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={cn("text-xs font-mono font-bold",
                      achieved ? "text-green-400" : onTrack ? "text-blue-400" : "text-orange-400"
                    )}>
                      {pct.toFixed(1)}% complete
                    </span>
                    <span className="text-white/25 text-xs">
                      {daysLeft > 0 ? `${daysLeft} days left` : "Ended"}
                    </span>
                  </div>
                </div>

                {/* Time vs progress indicator */}
                <div className="text-xs text-white/30">
                  Time elapsed: {timeProgress.toFixed(0)}% · Pace:{" "}
                  <span className={onTrack || achieved ? "text-green-400" : "text-orange-400"}>
                    {achieved ? "Goal complete!" :
                     onTrack ? "Ahead of pace" :
                     `Need ${METRIC_FORMAT(goal.metric, Math.round((goal.target_value - current) / Math.max(daysLeft, 1)))} /day`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
