"use client";

import { useState } from "react";
import { Subscription, UserRole } from "@/types";
import { formatINR, formatDate, statusColor, cn } from "@/lib/utils";
import { getPermissions } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";

interface Props {
  subscriptions: Subscription[];
  role: UserRole;
}

function monthlyEquivalent(sub: Subscription): number {
  switch (sub.billing_cycle) {
    case "monthly": return sub.cost;
    case "quarterly": return Math.round(sub.cost / 3);
    case "yearly": return Math.round(sub.cost / 12);
    default: return sub.cost;
  }
}

export function SubscriptionsClient({ subscriptions: initialSubs, role }: Props) {
  const perms = getPermissions(role);
  const supabase = createClient();
  const [subs, setSubs] = useState(initialSubs);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", plan: "", cost: "", billing_cycle: "monthly", next_due_date: "", status: "active", usage_notes: "", category: "", vendor_url: ""
  });

  const activeSubs = subs.filter(s => s.status === "active");
  const monthlyBurn = activeSubs.reduce((s, sub) => s + monthlyEquivalent(sub), 0);
  const annualProjection = monthlyBurn * 12;

  // Due in next 7 days
  const dueSoon = activeSubs.filter(s => {
    if (!s.next_due_date) return false;
    const daysUntil = Math.floor((new Date(s.next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase.from("subscriptions").insert({
      ...form,
      cost: Math.round(parseFloat(form.cost) * 100),
    }).select().single();
    if (data) setSubs(prev => [data, ...prev]);
    setShowForm(false);
    setForm({ name: "", plan: "", cost: "", billing_cycle: "monthly", next_due_date: "", status: "active", usage_notes: "", category: "", vendor_url: "" });
  }

  async function toggleStatus(sub: Subscription) {
    if (!perms.canManageSubscriptions) return;
    const newStatus = sub.status === "active" ? "paused" : "active";
    await supabase.from("subscriptions").update({ status: newStatus }).eq("id", sub.id);
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, status: newStatus } : s));
  }

  const inputCls = "input-base w-full text-sm";

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="metric-card">
          <p className="data-label mb-2">Monthly Burn</p>
          <p className="font-heading font-bold text-2xl text-white">{formatINR(monthlyBurn, true)}</p>
          <p className="font-mono text-xs text-white/30 mt-1">{activeSubs.length} active subs</p>
        </div>
        <div className="metric-card">
          <p className="data-label mb-2">Annual Projection</p>
          <p className="font-heading font-bold text-2xl text-white">{formatINR(annualProjection, true)}</p>
          <p className="font-mono text-xs text-white/30 mt-1">if all stay active</p>
        </div>
        <div className="metric-card">
          <p className="data-label mb-2">Due Soon</p>
          <p className={cn("font-heading font-bold text-2xl", dueSoon.length > 0 ? "text-yellow-400" : "text-white")}>{dueSoon.length}</p>
          <p className="font-mono text-xs text-white/30 mt-1">within 7 days</p>
        </div>
      </div>

      {/* Due Soon Alert */}
      {dueSoon.length > 0 && (
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-400 text-sm font-medium">Renewals due soon</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dueSoon.map(s => (
              <span key={s.id} className="text-xs bg-yellow-400/10 text-yellow-400/80 px-2.5 py-1 rounded-full font-medium">
                {s.name} · {s.next_due_date ? formatDate(s.next_due_date) : "—"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="section-title">All Subscriptions</h2>
        {perms.canManageSubscriptions && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary py-1.5 px-3 text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Subscription
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card-base p-5 animate-slide-up">
          <h3 className="font-heading font-semibold text-white mb-4">New Subscription</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            <div><label className="data-label block mb-1">Name</label><input required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className={inputCls} placeholder="e.g. Vercel" /></div>
            <div><label className="data-label block mb-1">Plan</label><input value={form.plan} onChange={e => setForm(p => ({...p, plan: e.target.value}))} className={inputCls} placeholder="Pro" /></div>
            <div><label className="data-label block mb-1">Cost (₹)</label><input required type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(p => ({...p, cost: e.target.value}))} className={inputCls} placeholder="0" /></div>
            <div>
              <label className="data-label block mb-1">Billing</label>
              <select value={form.billing_cycle} onChange={e => setForm(p => ({...p, billing_cycle: e.target.value}))} className={`${inputCls} bg-[#111116] cursor-pointer`}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div><label className="data-label block mb-1">Next Due</label><input type="date" value={form.next_due_date} onChange={e => setForm(p => ({...p, next_due_date: e.target.value}))} className={inputCls} /></div>
            <div><label className="data-label block mb-1">Category</label><input value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} className={inputCls} placeholder="e.g. Infrastructure" /></div>
            <div className="col-span-2"><label className="data-label block mb-1">Notes</label><input value={form.usage_notes} onChange={e => setForm(p => ({...p, usage_notes: e.target.value}))} className={inputCls} placeholder="Usage notes…" /></div>
            <div className="col-span-2 flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button type="submit" className="btn-primary flex-1 justify-center">Add Subscription</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card-base overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {["Name", "Plan", "Cost", "Monthly Equiv.", "Billing", "Next Due", "Status", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 data-label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-white/20">No subscriptions added</td></tr>
            ) : (
              subs.map(sub => (
                <tr key={sub.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white/85 font-medium">{sub.name}</p>
                      {sub.category && <p className="text-white/30 text-[10px]">{sub.category}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/50">{sub.plan ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-white/85">{formatINR(sub.cost, true)}</td>
                  <td className="px-4 py-3 font-mono text-white/50">{formatINR(monthlyEquivalent(sub), true)}/mo</td>
                  <td className="px-4 py-3 capitalize text-white/50">{sub.billing_cycle}</td>
                  <td className="px-4 py-3 font-mono text-white/50">{sub.next_due_date ? formatDate(sub.next_due_date) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("status-badge", statusColor(sub.status))}>{sub.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {perms.canManageSubscriptions && sub.status !== "cancelled" && (
                      <button
                        onClick={() => toggleStatus(sub)}
                        className="text-white/30 hover:text-white/70 transition-colors cursor-pointer text-[10px] font-medium"
                      >
                        {sub.status === "active" ? "Pause" : "Resume"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
