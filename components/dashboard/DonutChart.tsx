"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatINR } from "@/lib/utils";

const COLORS = ["#DC3C3C", "#3b82f6", "#f59e0b", "#22c55e", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

interface DonutChartProps {
  data: { category: string; amount: number }[];
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111116] border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-white/70 text-xs font-medium">{payload[0].name}</p>
      <p className="text-white font-mono font-medium text-sm">{formatINR(payload[0].value)}</p>
    </div>
  );
}

export function DonutChart({ data }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="flex items-center gap-5">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={65}
            dataKey="amount"
            nameKey="category"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex-1 space-y-1.5 min-w-0">
        {data.slice(0, 6).map((d, i) => (
          <div key={d.category} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-white/50 text-xs truncate flex-1">{d.category}</span>
            <span className="font-mono text-xs text-white/70">
              {total > 0 ? Math.round((d.amount / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
