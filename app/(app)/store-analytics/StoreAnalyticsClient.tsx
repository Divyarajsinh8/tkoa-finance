"use client";

import { useState, useMemo } from "react";
import { formatINR, formatDate, cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ShopifyOrder {
  id: string;
  store: string;
  shopify_order_id: string;
  order_number: string;
  customer_email: string;
  customer_name: string;
  is_new_customer: boolean;
  total_amount: number;
  subtotal: number;
  discount_amount: number;
  discount_code: string;
  payment_status: string;
  fulfillment_status: string;
  payment_gateway: string;
  line_items: { title: string; quantity: number; price: string }[];
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  created_at: string;
}

interface ShopifyCustomer {
  id: string;
  store: string;
  email: string;
  name: string;
  orders_count: number;
  total_spent: number;
  first_order_date: string;
  last_order_date: string;
  city: string;
  state: string;
}

interface ShopifyPayout {
  id: string;
  store: string;
  payout_id: string;
  amount: number;
  fees: number;
  net_amount: number;
  status: string;
  date: string;
}

const COLORS = ["#DC3C3C", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a24",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

export function StoreAnalyticsClient({
  orders,
}: {
  orders: ShopifyOrder[];
  customers?: ShopifyCustomer[];
  payouts?: ShopifyPayout[];
}) {
  const [activeStore, setActiveStore] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const stores = useMemo(() => {
    const s = new Set(orders.map(o => o.store));
    return ["all", ...Array.from(s)];
  }, [orders]);

  const filtered = useMemo(() =>
    activeStore === "all" ? orders : orders.filter(o => o.store === activeStore),
    [orders, activeStore]
  );

  const paidOrders = filtered.filter(o => o.payment_status === "paid");
  const totalRevenue = paidOrders.reduce((s, o) => s + o.total_amount, 0);
  const totalOrders = paidOrders.length;
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const newCustomers = paidOrders.filter(o => o.is_new_customer).length;
  const returningCustomers = totalOrders - newCustomers;
  const totalDiscounts = paidOrders.reduce((s, o) => s + (o.discount_amount || 0), 0);
  const refundedOrders = filtered.filter(o => o.payment_status === "refunded").length;
  const refundRate = totalOrders > 0 ? (refundedOrders / totalOrders * 100).toFixed(1) : "0";

  // Daily revenue chart — last 30 days
  const dailyChart = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of paidOrders) {
      const day = o.created_at.split("T")[0];
      map[day] = (map[day] || 0) + o.total_amount;
    }
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split("T")[0];
      return { day: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }), revenue: (map[key] || 0) / 100 };
    });
    return days;
  }, [paidOrders]);

  // Store comparison
  const storeChart = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders.filter(o => o.payment_status === "paid")) {
      map[o.store] = (map[o.store] || 0) + o.total_amount;
    }
    return Object.entries(map).map(([store, revenue]) => ({ store, revenue: revenue / 100 }));
  }, [orders]);

  // Discount code performance
  const discountPerf = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number; discount: number }> = {};
    for (const o of paidOrders.filter(o => o.discount_code)) {
      const code = o.discount_code;
      if (!map[code]) map[code] = { revenue: 0, orders: 0, discount: 0 };
      map[code].revenue += o.total_amount;
      map[code].orders += 1;
      map[code].discount += o.discount_amount || 0;
    }
    return Object.entries(map)
      .map(([code, d]) => ({ code, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [paidOrders]);

  // Top products
  const productPerf = useMemo(() => {
    const map: Record<string, { revenue: number; units: number }> = {};
    for (const o of paidOrders) {
      for (const item of (o.line_items || [])) {
        if (!map[item.title]) map[item.title] = { revenue: 0, units: 0 };
        map[item.title].revenue += Math.round(parseFloat(item.price) * item.quantity * 100);
        map[item.title].units += item.quantity;
      }
    }
    return Object.entries(map)
      .map(([title, d]) => ({ title, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [paidOrders]);

  // UTM source breakdown
  const utmChart = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of paidOrders) {
      const src = o.utm_source || "direct";
      map[src] = (map[src] || 0) + 1;
    }
    return Object.entries(map)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [paidOrders]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/sync/shopify", { method: "POST" });
      const data = await res.json();
      setSyncMsg(res.ok ? "Synced successfully! Refresh to see latest data." : `Error: ${data.error}`);
    } catch {
      setSyncMsg("Sync failed. Check console.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-heading font-bold text-xl">Store Analytics</h1>
          <p className="text-white/40 text-sm mt-0.5">Shopify performance — last 30 days</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Store filter */}
          <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
            {stores.map(s => (
              <button
                key={s}
                onClick={() => setActiveStore(s)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  activeStore === s ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60"
                )}
              >
                {s === "all" ? "All Stores" : s}
              </button>
            ))}
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
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className={cn("px-4 py-2 rounded-lg text-sm", syncMsg.includes("Error") ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20")}>
          {syncMsg}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Revenue", value: formatINR(totalRevenue, true), sub: "30 days", color: "text-green-400" },
          { label: "Orders", value: totalOrders.toString(), sub: "paid" },
          { label: "AOV", value: formatINR(aov, true), sub: "avg order" },
          { label: "New Customers", value: newCustomers.toString(), sub: `${totalOrders > 0 ? ((newCustomers / totalOrders) * 100).toFixed(0) : 0}% of orders` },
          { label: "Returning", value: returningCustomers.toString(), sub: "customers" },
          { label: "Discounts", value: formatINR(totalDiscounts, true), sub: "total given", color: "text-orange-400" },
          { label: "Refund Rate", value: `${refundRate}%`, sub: `${refundedOrders} orders`, color: parseFloat(refundRate) > 5 ? "text-red-400" : "text-white" },
        ].map(kpi => (
          <div key={kpi.label} className="card-base p-4">
            <p className="text-white/40 text-xs mb-1">{kpi.label}</p>
            <p className={cn("font-mono font-bold text-lg", kpi.color || "text-white")}>{kpi.value}</p>
            <p className="text-white/30 text-[10px] mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart + store split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card-base p-5">
          <h3 className="section-title mb-4">Daily Revenue — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyChart} barSize={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false}
                interval={6} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#DC3C3C" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-base p-5">
          <h3 className="section-title mb-4">Revenue by Store</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={storeChart} dataKey="revenue" nameKey="store" cx="50%" cy="50%" outerRadius={70} labelLine={false}>
                {storeChart.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* UTM + Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="card-base p-5">
          <h3 className="section-title mb-4">Top Products / Bundles</h3>
          <div className="space-y-2.5">
            {productPerf.length === 0 ? (
              <p className="text-white/20 text-sm text-center py-6">No product data — sync Shopify first</p>
            ) : (
              productPerf.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-white/80 text-xs font-medium truncate">{p.title}</p>
                    <p className="text-white/30 text-[10px]">{p.units} units sold</p>
                  </div>
                  <span className="font-mono text-xs text-green-400 shrink-0">{formatINR(p.revenue, true)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* UTM Sources */}
        <div className="card-base p-5">
          <h3 className="section-title mb-4">Traffic Sources (UTM)</h3>
          <div className="space-y-2.5">
            {utmChart.length === 0 ? (
              <p className="text-white/20 text-sm text-center py-6">No UTM data available</p>
            ) : (
              utmChart.map((u, i) => {
                const pct = totalOrders > 0 ? (u.count / totalOrders) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/70 text-xs capitalize">{u.source}</span>
                      <span className="text-white/40 text-xs font-mono">{u.count} orders ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#DC3C3C]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Discount codes */}
      {discountPerf.length > 0 && (
        <div className="card-base p-5">
          <h3 className="section-title mb-4">Discount Code Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Code", "Orders", "Revenue Generated", "Discount Given", "Avg Discount"].map(h => (
                    <th key={h} className="pb-2 text-left text-white/30 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {discountPerf.map((d, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2 font-mono text-[#DC3C3C] font-bold">{d.code}</td>
                    <td className="py-2 text-white/70">{d.orders}</td>
                    <td className="py-2 text-green-400 font-mono">{formatINR(d.revenue, true)}</td>
                    <td className="py-2 text-orange-400 font-mono">{formatINR(d.discount, true)}</td>
                    <td className="py-2 text-white/50 font-mono">{formatINR(d.orders > 0 ? d.discount / d.orders : 0, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Order", "Customer", "Store", "Amount", "Status", "Gateway", "Date"].map(h => (
                  <th key={h} className="pb-2 text-left text-white/30 font-medium pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((o) => (
                <tr key={o.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="py-2 font-mono text-white/70 pr-4">{o.order_number || o.shopify_order_id}</td>
                  <td className="py-2 text-white/60 pr-4 max-w-[120px] truncate">{o.customer_name || o.customer_email || "Guest"}</td>
                  <td className="py-2 pr-4">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-white/50">{o.store}</span>
                  </td>
                  <td className={cn("py-2 font-mono pr-4 font-medium", o.payment_status === "paid" ? "text-green-400" : "text-white/50")}>
                    {formatINR(o.total_amount, true)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                      o.payment_status === "paid" ? "bg-green-500/10 text-green-400" :
                      o.payment_status === "refunded" ? "bg-red-500/10 text-red-400" :
                      "bg-white/[0.06] text-white/40"
                    )}>{o.payment_status}</span>
                  </td>
                  <td className="py-2 text-white/40 pr-4">{o.payment_gateway}</td>
                  <td className="py-2 text-white/30 font-mono">{formatDate(o.created_at.split("T")[0])}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-white/20">No orders found — sync Shopify to get started</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
