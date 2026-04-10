"use client";

import { useState } from "react";
import { Budget, UserRole } from "@/types";
import { formatINR, cn } from "@/lib/utils";
import { getPermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  "Marketing", "Subscriptions", "Salaries", "Infrastructure", "Tools & Software",
  "Advertising", "Design", "Legal", "Accounting", "Office", "Travel", "Miscellaneous",
];

interface Props {
  budgets: Budget[];
  transactions: { category: string; amount: number; type: string }[];
  role: UserRole;
  currentMonth: string;
}

export function BudgetClient({ budgets: initialBudgets, transactions, role, currentMonth }: Props) {
  const perms = getPermissions(role);
  const supabase = createClient();
  const [budgets, setBudgets] = useState(initialBudgets);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const actualByCategory = transactions.reduce((acc: Record<string, number>, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});

  const budgetMap = budgets.reduce((acc: Record<string, Budget>, b) => {
    acc[b.category] = b;
    return acc;
  }, {});

  const totalBudget = budgets.reduce((s, b) => s + b.budgeted_amount, 0);
  const totalActual = transactions.reduce((s, t) => s + t.amount, 0);

  // Categories at or above 80% threshold
  const alertCategories = CATEGORIES.filter(cat => {
    const budget = budgetMap[cat]?.budgeted_amount ?? 0;
    const actual = actualByCategory[cat] ?? 0;
    return budget > 0 && actual / budget >= 0.8;
  });

  async function saveBudget(category: string) {
    const amount = Math.round(parseFloat(editAmount) * 100);
    const existing = budgetMap[category];
    if (existing) {
      await supabase.from("budgets").update({ budgeted_amount: amount }).eq("id", existing.id);
      setBudgets(prev => prev.map(b => b.category === category ? { ...b, budgeted_amount: amount } : b));
    } else {
      const { data } = await supabase
        .from("budgets")
        .insert({ category, month: currentMonth, budgeted_amount: amount })
        .select()
        .single();
      if (data) setBudgets(prev => [...prev, data]);
    }
    setEditCategory(null);
  }

  async function checkAndCreateAlerts() {
    setCheckingAlerts(true);
    setAlertMsg("");
    try {
      const res = await fetch("/api/budget/check-alerts", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAlertMsg(
          data.alerts > 0
            ? `✓ Created ${data.alerts} budget alert${data.alerts > 1 ? "s" : ""}. Check AI Alerts for details.`
            : "✓ All budgets checked. No new alerts triggered."
        );
      } else {
        setAlertMsg("Failed to check alerts.");
      }
    } catch {
      setAlertMsg("Error checking alerts.");
    } finally {
      setCheckingAlerts(false);
    }
  }

  const monthLabel = new Date(currentMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title text-xl">Budget vs Actual</h2>
          <p className="text-white/40 text-sm mt-0.5">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-xs text-white/40">Budget: {formatINR(totalBudget, true)}</p>
            <p className={cn("font-mono text-xs", totalActual > totalBudget ? "text-red-400" : "text-green-400")}>
              Actual: {formatINR(totalActual, true)}
            </p>
          </div>
          {perms.canSetBudgets && (
            <button
              onClick={checkAndCreateAlerts}
              disabled={checkingAlerts}
              className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {checkingAlerts ? "Checking…" : "Check Alerts"}
            </button>
          )}
        </div>
      </div>

      {alertMsg && (
        <div className={cn(
          "px-4 py-2.5 rounded-lg text-sm border",
          alertMsg.startsWith("✓")
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        )}>
          {alertMsg}
        </div>
      )}

      {/* 80% threshold alerts */}
      {alertCategories.length > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-semibold mb-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Budget Threshold Alerts
          </div>
          {alertCategories.map(cat => {
            const budget = budgetMap[cat]?.budgeted_amount ?? 0;
            const actual = actualByCategory[cat] ?? 0;
            const pct = Math.round((actual / budget) * 100);
            const isOver = actual > budget;
            return (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-white/70 text-xs">{cat}</span>
                <span className={cn(
                  "font-mono text-xs font-semibold",
                  isOver ? "text-red-400" : "text-yellow-400"
                )}>
                  {pct}% used
                  {isOver && <span className="text-red-400/70"> (+{formatINR(actual - budget, true)} over)</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Category bars */}
      <div className="card-base p-5 space-y-4">
        {CATEGORIES.map(cat => {
          const budget = budgetMap[cat]?.budgeted_amount ?? 0;
          const actual = actualByCategory[cat] ?? 0;
          const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
          const overspent = budget > 0 && actual > budget;
          const nearLimit = budget > 0 && actual >= budget * 0.8 && !overspent;
          const underspent = budget > 0 && actual < budget * 0.5;

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/70 text-sm">{cat}</span>
                  {nearLimit && (
                    <span className="text-[9px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full font-medium">
                      ≥80%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {editCategory === cat ? (
                    <div className="flex items-center gap-1">
                      <span className="text-white/40 text-xs">₹</span>
                      <input
                        autoFocus
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="input-base w-24 py-0.5 text-xs"
                        onBlur={() => editAmount && saveBudget(cat)}
                        onKeyDown={e => e.key === "Enter" && editAmount && saveBudget(cat)}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/40">
                        {budget > 0 ? formatINR(budget, true) : "—"}
                      </span>
                      {perms.canSetBudgets && (
                        <button
                          onClick={() => {
                            setEditCategory(cat);
                            setEditAmount(budget > 0 ? (budget / 100).toString() : "");
                          }}
                          className="text-white/20 hover:text-white/50 cursor-pointer transition-colors"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      <span className={cn(
                        "font-mono text-xs font-medium",
                        overspent ? "text-red-400" : actual > 0 ? "text-white/80" : "text-white/25"
                      )}>
                        {formatINR(actual, true)}
                      </span>
                    </div>
                  )}
                  {overspent && (
                    <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">Over</span>
                  )}
                  {nearLimit && !overspent && (
                    <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">Alert</span>
                  )}
                  {underspent && !nearLimit && !overspent && (
                    <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">Under</span>
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                {budget > 0 && (
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      overspent ? "bg-red-400" : nearLimit ? "bg-yellow-400" : "bg-[#DC3C3C]"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              {budget > 0 && (
                <div className="flex justify-between mt-0.5">
                  <span className="font-mono text-[10px] text-white/20">{pct.toFixed(0)}% used</span>
                  {overspent && (
                    <span className="font-mono text-[10px] text-red-400/60">
                      +{formatINR(actual - budget, true)} over
                    </span>
                  )}
                  {nearLimit && !overspent && (
                    <span className="font-mono text-[10px] text-yellow-400/60">
                      {formatINR(budget - actual, true)} left
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
