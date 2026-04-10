"use client";

import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatINR } from "@/lib/utils";

interface DataPoint {
  month: string;
  revenue: number;
  expenses: number;
}

interface BarChartProps {
  data: DataPoint[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111116] border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-white/60 text-xs font-medium mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/60 capitalize">{p.name}:</span>
          <span className="text-white font-mono font-medium">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function BarChart({ data }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RechartsBar data={data} barGap={4} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "JetBrains Mono" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "JetBrains Mono" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatINR(v, true)}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
          iconType="circle"
          iconSize={7}
        />
        <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#DC3C3C" radius={[4, 4, 0, 0]} />
      </RechartsBar>
    </ResponsiveContainer>
  );
}
