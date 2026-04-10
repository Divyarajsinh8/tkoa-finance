import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format paise to INR display string
export function formatINR(paise: number, compact = false): string {
  const rupees = paise / 100;
  if (compact && rupees >= 100000) {
    if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)}Cr`;
    if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)}L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

// Parse rupee string to paise
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

// Format date to display
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Format date for input fields
export function toInputDate(dateStr: string): string {
  return new Date(dateStr).toISOString().split("T")[0];
}

// Get current financial year (April to March)
export function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  if (month >= 3) return `FY ${year}-${(year + 1).toString().slice(2)}`;
  return `FY ${year - 1}-${year.toString().slice(2)}`;
}

// Get current quarter (Indian FY: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)
export function getCurrentQuarter(): string {
  const month = new Date().getMonth();
  if (month >= 3 && month <= 5) return "Q1";
  if (month >= 6 && month <= 8) return "Q2";
  if (month >= 9 && month <= 11) return "Q3";
  return "Q4";
}

// Get GST due date for quarter
export function getGSTDueDate(): string {
  const quarter = getCurrentQuarter();
  const year = new Date().getFullYear();
  const dueDates: Record<string, string> = {
    Q1: `20 Jul ${year}`,
    Q2: `20 Oct ${year}`,
    Q3: `20 Jan ${year + 1}`,
    Q4: `20 Apr ${year + 1}`,
  };
  return dueDates[quarter];
}

// Calculate percentage change
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// Format percentage
export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

// Get month label
export function getMonthLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

// Truncate text
export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// Status color mapping
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    paid: "text-green-400 bg-green-400/10",
    received: "text-green-400 bg-green-400/10",
    pending: "text-yellow-400 bg-yellow-400/10",
    overdue: "text-red-400 bg-red-400/10",
    cancelled: "text-white/40 bg-white/5",
    draft: "text-blue-400 bg-blue-400/10",
    active: "text-green-400 bg-green-400/10",
    paused: "text-yellow-400 bg-yellow-400/10",
    free: "text-blue-400 bg-blue-400/10",
  };
  return map[status] ?? "text-white/60 bg-white/5";
}

// Generate sparkline data
export function generateSparkline(value: number, count = 7): number[] {
  const data: number[] = [];
  let current = value * 0.7;
  for (let i = 0; i < count; i++) {
    current *= 1 + (Math.random() - 0.4) * 0.2;
    data.push(Math.round(current));
  }
  data[data.length - 1] = value;
  return data;
}

// Indian number system format (without currency symbol)
export function formatINRNumber(paise: number): string {
  return (paise / 100).toLocaleString("en-IN");
}
