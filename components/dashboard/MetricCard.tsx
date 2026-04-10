"use client";

import { cn } from "@/lib/utils";
import { SparkLine } from "./SparkLine";

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  change?: number; // percentage
  sparkData?: number[];
  sparkColor?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({
  label,
  value,
  subValue,
  change,
  sparkData,
  sparkColor,
  icon,
  trend,
  className,
}: MetricCardProps) {
  const isPositive = change !== undefined ? change >= 0 : trend === "up";
  const isNeutral = change === 0 || trend === "neutral";

  const changeColor = isNeutral
    ? "text-white/40"
    : isPositive
    ? "text-green-400"
    : "text-red-400";

  return (
    <div className={cn("metric-card animate-slide-up", className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="w-7 h-7 rounded-md bg-white/[0.05] flex items-center justify-center text-white/50">
              {icon}
            </div>
          )}
          <span className="data-label">{label}</span>
        </div>
        {sparkData && (
          <SparkLine
            data={sparkData}
            color={sparkColor ?? (isPositive ? "#22c55e" : "#DC3C3C")}
          />
        )}
      </div>

      <div className="space-y-0.5">
        <p className="font-heading font-bold text-2xl text-white leading-none">{value}</p>
        {subValue && <p className="font-mono text-xs text-white/40">{subValue}</p>}
      </div>

      {change !== undefined && (
        <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium", changeColor)}>
          {!isNeutral && (
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className={isPositive ? "" : "rotate-180"}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          )}
          <span>{Math.abs(change).toFixed(1)}% vs last month</span>
        </div>
      )}
    </div>
  );
}
