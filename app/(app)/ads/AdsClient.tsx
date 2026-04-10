"use client";

import { useState, useMemo } from "react";
import { formatINR, formatDate, cn } from "@/lib/utils";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";

interface MetaAd {
  id: string;
  date: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cost_per_conversion: number;
  add_to_carts: number;
  checkouts_initiated: number;
  frequency: number;
  video_views_25: number;
  video_views_100: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a24",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

export function AdsClient({ ads, lastSync }: { ads: MetaAd[]; lastSync: { completed_at: string; status: string } | null }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  // Totals
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const totalRevenue = ads.reduce((s, a) => s + a.conversion_value, 0);
  const totalConversions = ads.reduce((s, a) => s + a.conversions, 0);
  const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.link_clicks, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Daily trend
  const dailyTrend = useMemo(() => {
    const map: Record<string, { spend: number; revenue: number; conversions: number }> = {};
    for (const a of ads) {
      if (!map[a.date]) map[a.date] = { spend: 0, revenue: 0, conversions: 0 };
      map[a.date].spend += a.spend;
      map[a.date].revenue += a.conversion_value;
      map[a.date].conversions += a.conversions;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date: new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        spend: d.spend / 100,
        revenue: d.revenue / 100,
        roas: d.spend > 0 ? (d.revenue / d.spend) : 0,
      }));
  }, [ads]);

  // Campaign aggregation
  const campaignData = useMemo(() => {
    const map: Record<string, { spend: number; revenue: number; conversions: number; impressions: number; clicks: number; name: string }> = {};
    for (const a of ads) {
      const key = a.campaign_id;
      if (!key) continue;
      if (!map[key]) map[key] = { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0, name: a.campaign_name };
      map[key].spend += a.spend;
      map[key].revenue += a.conversion_value;
      map[key].conversions += a.conversions;
      map[key].impressions += a.impressions;
      map[key].clicks += a.link_clicks;
    }
    return Object.entries(map)
      .map(([id, d]) => ({
        id,
        name: d.name,
        spend: d.spend,
        revenue: d.revenue,
        conversions: d.conversions,
        roas: d.spend > 0 ? d.revenue / d.spend : 0,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        cpa: d.conversions > 0 ? d.spend / d.conversions : 0,
        impressions: d.impressions,
      }))
      .sort((a, b) => b.roas - a.roas);
  }, [ads]);

  const bestCampaigns = campaignData.filter(c => c.roas >= 1.5).slice(0, 5);
  const worstCampaigns = campaignData.filter(c => c.roas < 1 && c.spend > 10000).slice(0, 5);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/sync/meta-ads", { method: "POST" });
      const data = await res.json();
      setSyncMsg(res.ok ? `Synced ${data.records} records!` : `Error: ${data.error}`);
    } catch {
      setSyncMsg("Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const roasColor = (roas: number) =>
    roas >= 3 ? "text-green-400" :
    roas >= 1.5 ? "text-blue-400" :
    roas >= 1 ? "text-orange-400" :
    "text-red-400";

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-heading font-bold text-xl">Ad Performance</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Meta Ads · Last 30 days
            {lastSync && <span className="ml-2">· Last sync: {formatDate(lastSync.completed_at?.split("T")[0])}</span>}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-[#DC3C3C]/10 hover:bg-[#DC3C3C]/20 text-[#DC3C3C] rounded-lg border border-[#DC3C3C]/20 transition-all disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={cn(syncing && "animate-spin")}>
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {syncing ? "Syncing..." : "Sync Meta Ads"}
        </button>
      </div>

      {syncMsg && (
        <div className={cn("px-4 py-2 rounded-lg text-sm border", syncMsg.includes("Error") ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20")}>
          {syncMsg}
        </div>
      )}

      {ads.length === 0 ? (
        <div className="card-base p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
              <path d="M18 20V10M12 20V4M6 20v-6M2 20h20" />
            </svg>
          </div>
          <p className="text-white/40 text-sm">No Meta Ads data yet</p>
          <p className="text-white/20 text-xs mt-1">Add META_ADS_ACCESS_TOKEN and click Sync</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Total Spend", value: formatINR(totalSpend, true), color: "text-orange-400" },
              { label: "Ad Revenue", value: formatINR(totalRevenue, true), color: "text-green-400" },
              { label: "Overall ROAS", value: `${overallRoas.toFixed(2)}x`, color: overallRoas >= 2 ? "text-green-400" : overallRoas >= 1 ? "text-orange-400" : "text-red-400" },
              { label: "Conversions", value: totalConversions.toString() },
              { label: "CPA", value: formatINR(cpa, true) },
              { label: "Avg CTR", value: `${avgCtr.toFixed(2)}%` },
              { label: "Avg CPC", value: formatINR(avgCpc, true) },
            ].map(kpi => (
              <div key={kpi.label} className="card-base p-4">
                <p className="text-white/40 text-xs mb-1">{kpi.label}</p>
                <p className={cn("font-mono font-bold text-base", kpi.color || "text-white")}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Spend vs Revenue Chart */}
          <div className="card-base p-5">
            <h3 className="section-title mb-4">Daily Spend vs Revenue</h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, name: unknown) => [
                  name === "roas" ? `${Number(v).toFixed(2)}x` : `₹${Number(v).toLocaleString("en-IN")}`,
                  name === "spend" ? "Spend" : name === "revenue" ? "Revenue" : "ROAS"
                ]} />
                <Bar dataKey="spend" fill="rgba(245,158,11,0.6)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="revenue" fill="rgba(34,197,94,0.6)" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Best / Worst campaigns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card-base p-5">
              <h3 className="section-title text-green-400 mb-4">Scale These — ROAS ≥ 1.5x</h3>
              <div className="space-y-3">
                {bestCampaigns.length === 0 ? (
                  <p className="text-white/20 text-sm text-center py-4">No high-ROAS campaigns right now</p>
                ) : (
                  bestCampaigns.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white/80 text-xs font-medium truncate">{c.name}</p>
                        <p className="text-white/30 text-[10px]">
                          {c.conversions} conv · {formatINR(c.spend, true)} spend
                        </p>
                      </div>
                      <span className={cn("font-mono text-sm font-bold shrink-0", roasColor(c.roas))}>
                        {c.roas.toFixed(2)}x
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card-base p-5">
              <h3 className="section-title text-red-400 mb-4">Pause These — ROAS &lt; 1x</h3>
              <div className="space-y-3">
                {worstCampaigns.length === 0 ? (
                  <p className="text-white/20 text-sm text-center py-4">All campaigns profitable</p>
                ) : (
                  worstCampaigns.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white/80 text-xs font-medium truncate">{c.name}</p>
                        <p className="text-white/30 text-[10px]">
                          {c.conversions} conv · {formatINR(c.spend, true)} wasted
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-red-400 shrink-0">
                        {c.roas.toFixed(2)}x
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Full campaign table */}
          <div className="card-base p-5">
            <h3 className="section-title mb-4">All Campaigns — 30 Day View</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Campaign", "Spend", "Revenue", "ROAS", "Conversions", "CPA", "CTR", "Impressions"].map(h => (
                      <th key={h} className="pb-2 text-left text-white/30 font-medium pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaignData.map(c => (
                    <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 pr-4 text-white/80 font-medium max-w-[200px] truncate">{c.name}</td>
                      <td className="py-2 pr-4 text-orange-400 font-mono">{formatINR(c.spend, true)}</td>
                      <td className="py-2 pr-4 text-green-400 font-mono">{formatINR(c.revenue, true)}</td>
                      <td className={cn("py-2 pr-4 font-mono font-bold", roasColor(c.roas))}>{c.roas.toFixed(2)}x</td>
                      <td className="py-2 pr-4 text-white/60">{c.conversions}</td>
                      <td className="py-2 pr-4 text-white/50 font-mono">{formatINR(c.cpa, true)}</td>
                      <td className="py-2 pr-4 text-white/50 font-mono">{c.ctr.toFixed(2)}%</td>
                      <td className="py-2 text-white/30 font-mono">{(c.impressions / 1000).toFixed(1)}K</td>
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
