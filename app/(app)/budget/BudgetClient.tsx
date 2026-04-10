"use client";

import { useState } from "react";
import { Budget, UserRole } from "@/types";
import { formatINR, cn } from "@/lib/utils";
import { getPermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["Marketing", "Subscriptions", "Salaries", "Infrastructure", "Tools & Software", "Advertising", "Design", "Legal", "Accounting", "Office", "Travel", "Miscellaneous"];

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

  async function saveBudget(category: string) {
    const amount = Math.round(parseFloat(editAmount) * 100);
    const existing = budgetMap[category];
    if (existing) {
      await supabase.from("budgets").update({ budgeted_amount: amount }).eq("id", existing.id);
      setBudgets(prev => prev.map(b => b.category === category ? { ...b, budgeted_amount: amount } : b));
    } else {
      const { data } = await supabase.from("budgets").insert({ category, month: currentMonth, budgeted_amount: amount }).select().single();
      if (data) setBudgets(prev => [...prev, data]);
    }
    setEditCategory(null);
  }

  const monthLabel = new Date(currentMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title text-xl">Budget vs Actual</h2>
          <p className="text-white/40 text-sm mt-0.5">{monthLabel}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-white/40">Budget: {formatINR(totalBudget, true)}</p>
          <p className={cn("font-mono text-xs", totalActual > totalBudget ? "text-red-400" : "text-green-400")}>
            Actual: {formatINR(totalActual, true)}
          </p>
        </div>
      </div>

      {/* Category bars */}
      <div className="card-base p-5 space-y-4">
        {CATEGORIES.map(cat => {
          const budget = budgetMap[cat]?.budgeted_amount ?? 0;
          const actual = actualByCategory[cat] ?? 0;
          const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
          const overspent = budget > 0 && actual > budget;
          const underspent = budget > 0 && actual < budget * 0.5;

          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/70 text-sm">{cat}</span>
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
                      <span className="font-mono text-xs text-white/40">{budget > 0 ? formatINR(budget, true) : "—"}</span>
                      {perms.canSetBudgets && (
                        <button onClick={() => { setEditCategory(cat); setEditAmount(budget > 0 ? (budget / 100).toString() : ""); }} className="text-white/20 hover:text-white/50 cursor-pointer transition-colors">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      <span className={cn("font-mono text-xs font-medium", overspent ? "text-red-400" : actual > 0 ? "text-white/80" : "text-white/25")}>
                        {formatINR(actual, true)}
                      </span>
                    </div>
                  )}
                  {overspent && <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">Over</span>}
                  {underspent && <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">Under</span>}
                </div>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                {budget > 0 && (
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", overspent ? "bg-red-400" : pct > 75 ? "bg-yellow-400" : "bg-[#DC3C3C]")}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              {budget > 0 && (
                <div className="flex justify-between mt-0.5">
                  <span className="font-mono text-[10px] text-white/20">{pct.toFixed(0)}% used</span>
                  {overspent && <span className="font-mono text-[10px] text-red-400/60">+{formatINR(actual - budget, true)} over</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
