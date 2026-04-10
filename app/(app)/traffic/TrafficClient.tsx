"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface GA4Row {
  id: string;
  date: string;
  property: string;
  sessions: number;
  users: number;
  new_users: number;
  page_views: number;
  avg_session_duration: number;
  bounce_rate: number;
  conversions: number;
  conversion_rate: number;
  organic_sessions: number;
  paid_sessions: number;
  social_sessions: number;
  direct_sessions: number;
  referral_sessions: number;
  email_sessions: number;
  mobile_sessions: number;
  desktop_sessions: number;
  tablet_sessions: number;
  top_pages: { path: string; sessions: number; views: number }[];
}

const COLORS = ["#22c55e", "#3b82f6", "#DC3C3C", "#f59e0b", "#8b5cf6", "#ec4899"];
const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a24",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

export function TrafficClient({ data }: { data: GA4Row[] }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const totals = useMemo(() => ({
    sessions: data.reduce((s, d) => s + d.sessions, 0),
    users: data.reduce((s, d) => s + d.users, 0),
    newUsers: data.reduce((s, d) => s + d.new_users, 0),
    pageViews: data.reduce((s, d) => s + d.page_views, 0),
    conversions: data.reduce((s, d) => s + d.conversions, 0),
    avgBounce: data.length > 0 ? data.reduce((s, d) => s + d.bounce_rate, 0) / data.length : 0,
    avgDuration: data.length > 0 ? data.reduce((s, d) => s + d.avg_session_duration, 0) / data.length : 0,
    avgCr: data.length > 0 ? data.reduce((s, d) => s + d.conversion_rate, 0) / data.length : 0,
  }), [data]);

  // Daily chart
  const dailyChart = useMemo(() => {
    return [...data].reverse().map(d => ({
      date: new Date(d.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      sessions: d.sessions,
      users: d.users,
      conversions: d.conversions,
    }));
  }, [data]);

  // Traffic source aggregate
  const sources = useMemo(() => {
    const agg = {
      Organic: data.reduce((s, d) => s + d.organic_sessions, 0),
      Paid: data.reduce((s, d) => s + d.paid_sessions, 0),
      Social: data.reduce((s, d) => s + d.social_sessions, 0),
      Direct: data.reduce((s, d) => s + d.direct_sessions, 0),
      Referral: data.reduce((s, d) => s + d.referral_sessions, 0),
      Email: data.reduce((s, d) => s + d.email_sessions, 0),
    };
    return Object.entries(agg)
      .map(([source, sessions]) => ({ source, sessions }))
      .filter(s => s.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions);
  }, [data]);

  // Device split
  const devices = useMemo(() => [
    { device: "Mobile", sessions: data.reduce((s, d) => s + d.mobile_sessions, 0) },
    { device: "Desktop", sessions: data.reduce((s, d) => s + d.desktop_sessions, 0) },
    { device: "Tablet", sessions: data.reduce((s, d) => s + d.tablet_sessions, 0) },
  ].filter(d => d.sessions > 0), [data]);

  // Top pages (aggregate)
  const topPages = useMemo(() => {
    const map: Record<string, { sessions: number; views: number }> = {};
    for (const row of data) {
      for (const page of (row.top_pages || [])) {
        if (!map[page.path]) map[page.path] = { sessions: 0, views: 0 };
        map[page.path].sessions += page.sessions;
        map[page.path].views += page.views;
      }
    }
    return Object.entries(map)
      .map(([path, d]) => ({ path, ...d }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);
  }, [data]);

  const totalSessions = totals.sessions;

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/ga4", { method: "POST" });
      const d = await res.json();
      setSyncMsg(res.ok ? `Synced ${d.records} days of data!` : `Error: ${d.error}`);
    } catch {
      setSyncMsg("Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-heading font-bold text-xl">Traffic & Conversions</h1>
          <p className="text-white/40 text-sm mt-0.5">Google Analytics 4 · Last 30 days</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#DC3C3C]/10 hover:bg-[#DC3C3C]/20 text-[#DC3C3C] rounded-lg border border-[#DC3C3C]/20 transition-all disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className={cn(syncing && "animate-spin")}>
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {syncing ? "Syncing..." : "Sync GA4"}
        </button>
      </div>

      {syncMsg && (
        <div className={cn("px-4 py-2 rounded-lg text-sm border", syncMsg.includes("Error") ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20")}>
          {syncMsg}
        </div>
      )}

      {data.length === 0 ? (
        <div className="card-base p-12 text-center">
          <p className="text-white/40 text-sm">No GA4 data yet</p>
          <p className="text-white/20 text-xs mt-1">Add GA4_PROPERTY_ID and GOOGLE_SERVICE_ACCOUNT_KEY, then click Sync</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Sessions", value: totals.sessions.toLocaleString("en-IN") },
              { label: "Users", value: totals.users.toLocaleString("en-IN") },
              { label: "New Users", value: totals.newUsers.toLocaleString("en-IN"), color: "text-green-400" },
              { label: "Page Views", value: totals.pageViews.toLocaleString("en-IN") },
              { label: "Conversions", value: totals.conversions.toLocaleString("en-IN"), color: "text-blue-400" },
              { label: "Avg CR", value: `${totals.avgCr.toFixed(2)}%`, color: totals.avgCr > 1 ? "text-green-400" : "text-orange-400" },
              { label: "Bounce Rate", value: `${totals.avgBounce.toFixed(1)}%`, color: totals.avgBounce > 70 ? "text-red-400" : "text-white" },
              { label: "Avg Duration", value: `${Math.floor(totals.avgDuration / 60)}m ${Math.round(totals.avgDuration % 60)}s` },
            ].map(kpi => (
              <div key={kpi.label} className="card-base p-3">
                <p className="text-white/40 text-[10px] mb-1">{kpi.label}</p>
                <p className={cn("font-mono font-bold text-sm", kpi.color || "text-white")}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Sessions trend */}
          <div className="card-base p-5">
            <h3 className="section-title mb-4">Sessions Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dailyChart}>
                <defs>
                  <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} fill="url(#sessGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sources + Devices */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 card-base p-5">
              <h3 className="section-title mb-4">Traffic Sources</h3>
              <div className="space-y-3">
                {sources.map((s, i) => {
                  const pct = totalSessions > 0 ? (s.sessions / totalSessions) * 100 : 0;
                  return (
                    <div key={s.source}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-xs">{s.source}</span>
                        <span className="text-white/40 text-xs font-mono">{s.sessions.toLocaleString("en-IN")} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-base p-5">
              <h3 className="section-title mb-4">Device Split</h3>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={devices} dataKey="sessions" nameKey="device" cx="50%" cy="50%" outerRadius={60} innerRadius={30} labelLine={false}>
                    {devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top pages */}
          <div className="card-base p-5">
            <h3 className="section-title mb-4">Top Pages</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Page", "Sessions", "Page Views", "% of Total"].map(h => (
                      <th key={h} className="pb-2 text-left text-white/30 font-medium pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((p, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 pr-4 font-mono text-white/60 max-w-[300px] truncate">{p.path}</td>
                      <td className="py-2 pr-4 text-white/70">{p.sessions.toLocaleString("en-IN")}</td>
                      <td className="py-2 pr-4 text-white/50">{p.views.toLocaleString("en-IN")}</td>
                      <td className="py-2 text-white/30">{totalSessions > 0 ? ((p.sessions / totalSessions) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
