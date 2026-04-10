"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { createClient } from "@/lib/supabase/client";

// Icons as inline SVGs for zero-dependency
const Icon = ({ d, d2, ...props }: { d: string; d2?: string; strokeWidth?: number }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth ?? 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
    {d2 && <path d={d2} />}
  </svg>
);

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  managerPlus?: boolean;
  badge?: string;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Command Center",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
      },
      {
        href: "/goals",
        label: "Goals & OKRs",
        icon: <Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
      },
      {
        href: "/briefing",
        label: "AI Briefing",
        icon: <Icon d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />,
      },
    ],
  },
  {
    label: "Revenue",
    items: [
      {
        href: "/store-analytics",
        label: "Store Analytics",
        icon: <Icon d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" d2="M7 7h.01" />,
      },
      {
        href: "/payments-hub",
        label: "Payments Hub",
        icon: <Icon d="M21 4H3a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zM1 10h22" />,
      },
      {
        href: "/traffic",
        label: "Traffic & Conversions",
        icon: <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />,
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        href: "/ads",
        label: "Ad Performance",
        icon: <Icon d="M18 20V10M12 20V4M6 20v-6" />,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: "/transactions",
        label: "Transactions",
        icon: <Icon d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
      },
      {
        href: "/invoices",
        label: "Invoices & Docs",
        icon: <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" d2="M14 2v6h6M16 13H8M16 17H8M10 9H8" />,
      },
      {
        href: "/subscriptions",
        label: "Subscriptions",
        icon: <Icon d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />,
      },
      {
        href: "/bank-statements",
        label: "Bank Statements",
        icon: <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" d2="M9 22V12h6v10" />,
      },
      {
        href: "/pl",
        label: "P&L Statement",
        icon: <Icon d="M18 20V10M12 20V4M6 20v-6M2 20h20" />,
      },
      {
        href: "/cashflow",
        label: "Cash Flow",
        icon: <Icon d="M22 12h-4l-3 9L9 3l-3 9H2" />,
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        href: "/ai",
        label: "AI Advisor",
        icon: <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
      },
      {
        href: "/scenarios",
        label: "What-If Scenarios",
        icon: <Icon d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />,
      },
      {
        href: "/forecast",
        label: "Revenue Forecast",
        icon: <Icon d="M21 21H3M21 7l-5 5-4-4-5 5" />,
      },
      {
        href: "/budget",
        label: "Budget vs Actual",
        icon: <Icon d="M12 2a10 10 0 1 0 10 10" d2="M12 6v6l4 2" />,
      },
      {
        href: "/tax",
        label: "Tax & GST",
        icon: <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
        adminOnly: true,
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/reports",
        label: "Reports Hub",
        icon: <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8" />,
        managerPlus: true,
      },
      {
        href: "/audit",
        label: "Audit Log",
        icon: <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
        adminOnly: true,
      },
    ],
  },
];

interface SidebarProps {
  role: UserRole;
  userName: string;
  alertCount?: number;
}

export function Sidebar({ role, userName, alertCount = 0 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const roleBadge = {
    admin: "bg-[#DC3C3C]/20 text-[#DC3C3C]",
    manager: "bg-blue-500/20 text-blue-400",
    viewer: "bg-white/10 text-white/50",
  }[role];

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-[#0c0c10] border-r border-white/[0.06] transition-all duration-200 shrink-0 overflow-hidden",
        collapsed ? "w-[52px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-12 border-b border-white/[0.06] shrink-0",
        collapsed ? "justify-center px-3" : "gap-2.5 px-4"
      )}>
        <div className="w-6 h-6 rounded-md bg-[#DC3C3C] flex items-center justify-center shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <div className="font-heading font-bold text-white text-[13px] leading-none">TKOA Finance</div>
            <div className="text-white/30 text-[9px] font-mono mt-0.5">Command Center</div>
          </div>
        )}
      </div>

      {/* Nav — scrollable */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-none">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(item => {
            if (item.adminOnly && role !== "admin") return false;
            if (item.managerPlus && role === "viewer") return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-1">
              {!collapsed && (
                <p className="px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-widest text-white/20 font-mono">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="h-2" />}
              <div className="px-1.5 space-y-0.5">
                {visibleItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-100 cursor-pointer relative group",
                        collapsed ? "justify-center" : "",
                        active
                          ? "bg-white/[0.07] text-white"
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                      )}
                    >
                      <span className={cn("shrink-0 transition-colors", active ? "text-[#DC3C3C]" : "group-hover:text-white/60")}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className={cn("font-medium truncate", active ? "text-white" : "")}>
                          {item.label}
                        </span>
                      )}
                      {/* Active indicator */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#DC3C3C] rounded-r-full" />
                      )}
                      {/* Alert badge on AI Advisor */}
                      {item.href === "/ai" && alertCount > 0 && !collapsed && (
                        <span className="ml-auto bg-[#DC3C3C] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                          {alertCount > 99 ? "99+" : alertCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] shrink-0">
        {/* Settings */}
        <div className="px-1.5 pt-1.5 pb-1">
          <Link
            href="/settings"
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all cursor-pointer",
              collapsed ? "justify-center" : ""
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-4 py-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#DC3C3C]/20 flex items-center justify-center shrink-0">
              <span className="text-[#DC3C3C] text-[10px] font-bold">{userName[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white/70 text-xs font-medium truncate">{userName}</p>
              <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", roleBadge)}>
                {role}
              </span>
            </div>
          </div>
        )}

        {/* Sign out + collapse */}
        <div className="px-1.5 pb-2 flex gap-1">
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-white/25 hover:text-red-400 hover:bg-red-400/5 transition-all cursor-pointer",
              collapsed ? "w-full justify-center" : "flex-1"
            )}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
            className="flex items-center justify-center w-8 h-8 rounded-md text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className={cn("transition-transform duration-200", collapsed ? "rotate-180" : "")}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
