import { createClient } from "@/lib/supabase/server";
import { TwoFactorSetup } from "./TwoFactorSetup";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("*, totp_enabled")
    .eq("id", user?.id ?? "")
    .single();

  // Get sync log for integration status
  const { data: syncLogs } = await supabase
    .from("sync_log")
    .select("source, status, completed_at, records_synced, error_message")
    .order("completed_at", { ascending: false })
    .limit(20);

  // Build status map per source
  const statusMap: Record<string, { status: string; lastSync?: string; records?: number; error?: string }> = {};
  for (const log of (syncLogs || [])) {
    if (!statusMap[log.source]) {
      statusMap[log.source] = {
        status: log.status,
        lastSync: log.completed_at,
        records: log.records_synced,
        error: log.error_message,
      };
    }
  }

  const integrations = [
    {
      name: "Supabase",
      desc: "Database & Authentication",
      source: "supabase",
      configured: true,
      docLink: null,
    },
    {
      name: "Anthropic Claude AI",
      desc: "AI Advisor, Invoice OCR, Briefings, Forecasts",
      source: "anthropic",
      configured: !!process.env.ANTHROPIC_API_KEY,
      envVar: "ANTHROPIC_API_KEY",
    },
    {
      name: "Shopify — Store 1",
      desc: "TheKnockoutAutomations orders, customers, payouts",
      source: "shopify_TheKnockoutAutomations",
      configured: !!(
        process.env.SHOPIFY_STORE_1_CLIENT_ID && process.env.SHOPIFY_STORE_1_CLIENT_SECRET
      ) || !!process.env.SHOPIFY_STORE_1_TOKEN,
      envVar: "SHOPIFY_STORE_1_CLIENT_ID + SHOPIFY_STORE_1_CLIENT_SECRET",
    },
    {
      name: "Shopify — Store 2",
      desc: "TheKnockoutAcademy (configure when ready)",
      source: "shopify_TheKnockoutAcademy",
      configured: !!process.env.SHOPIFY_STORE_2_TOKEN,
      envVar: "SHOPIFY_STORE_2_TOKEN",
    },
    {
      name: "Meta Ads",
      desc: "Facebook + Instagram ad spend, ROAS, campaigns",
      source: "meta_ads",
      configured: !!process.env.META_ADS_ACCESS_TOKEN,
      envVar: "META_ADS_ACCESS_TOKEN",
    },
    {
      name: "Cashfree Payments",
      desc: "Payment transactions and settlements",
      source: "cashfree",
      configured: !!(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET),
      envVar: "CASHFREE_CLIENT_ID + CASHFREE_CLIENT_SECRET",
    },
    {
      name: "Google Analytics 4",
      desc: "Traffic, conversions, device and source data",
      source: "ga4",
      configured: !!(process.env.GA4_PROPERTY_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      envVar: "GA4_PROPERTY_ID + GOOGLE_SERVICE_ACCOUNT_KEY",
    },
    {
      name: "Google Drive",
      desc: "Invoice file storage and organization",
      source: "google_drive",
      configured: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
      envVar: "GOOGLE_DRIVE_FOLDER_ID",
    },
    {
      name: "Resend (Email)",
      desc: "Daily briefings, weekly reports, critical alerts",
      source: "resend",
      configured: !!process.env.RESEND_API_KEY,
      envVar: "RESEND_API_KEY",
    },
  ];

  const configuredCount = integrations.filter(i => i.configured).length;

  return (
    <div className="max-w-3xl space-y-5">
      <h2 className="text-white font-heading font-bold text-xl">Settings & Integrations</h2>

      {/* Profile */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">Profile</h3>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#DC3C3C]/20 flex items-center justify-center">
            <span className="text-[#DC3C3C] text-xl font-bold">{profile?.full_name?.[0]?.toUpperCase() ?? "U"}</span>
          </div>
          <div>
            <p className="text-white font-semibold">{profile?.full_name ?? "User"}</p>
            <p className="text-white/50 text-sm">{user?.email}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#DC3C3C]/20 text-[#DC3C3C] font-semibold capitalize">{profile?.role}</span>
          </div>
        </div>
      </div>

      {/* Integration health overview */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Integrations</h3>
          <span className="text-xs text-white/30 font-mono">{configuredCount}/{integrations.length} configured</span>
        </div>

        <div className="space-y-3">
          {integrations.map(({ name, desc, source, configured, envVar }) => {
            const syncInfo = statusMap[source];
            const hasError = syncInfo?.status === "error";
            const lastSyncDate = syncInfo?.lastSync
              ? new Date(syncInfo.lastSync).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : null;

            return (
              <div key={name} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    !configured ? "bg-white/20" :
                    hasError ? "bg-red-400" :
                    syncInfo ? "bg-green-400" :
                    "bg-yellow-400"
                  }`} />
                  <div className="min-w-0">
                    <p className="text-white/80 text-sm font-medium">{name}</p>
                    <p className="text-white/30 text-xs">{desc}</p>
                    {configured && lastSyncDate && (
                      <p className="text-white/20 text-[10px] font-mono mt-0.5">
                        Last sync: {lastSyncDate}
                        {syncInfo?.records ? ` · ${syncInfo.records} records` : ""}
                      </p>
                    )}
                    {hasError && syncInfo?.error && (
                      <p className="text-red-400/70 text-[10px] mt-0.5">{syncInfo.error.slice(0, 60)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!configured && envVar && (
                    <span className="text-[10px] text-white/25 font-mono hidden md:block">{envVar}</span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                    !configured ? "bg-white/[0.05] text-white/25" :
                    hasError ? "bg-red-500/10 text-red-400" :
                    syncInfo ? "bg-green-500/10 text-green-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {!configured ? "Not configured" :
                     hasError ? "Error" :
                     syncInfo ? "Syncing" :
                     "Ready"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cron schedule */}
      <div className="card-base p-5">
        <h3 className="section-title mb-4">Automated Schedule</h3>
        <div className="space-y-2.5">
          {[
            { job: "Sync all sources", schedule: "Every 4 hours", endpoint: "/api/sync/all" },
            { job: "AI Morning Briefing", schedule: "Daily 8:00 AM IST", endpoint: "/api/ai/briefing" },
            { job: "Anomaly Detection", schedule: "Every 6 hours", endpoint: "/api/ai/anomaly-check" },
            { job: "Weekly Report", schedule: "Monday 8:30 AM IST", endpoint: "/api/ai/weekly-report" },
            { job: "Revenue Forecast", schedule: "Monday 9:30 AM IST", endpoint: "/api/ai/forecast" },
            { job: "Budget Alert Check", schedule: "Daily 8:30 AM IST", endpoint: "/api/budget/check-alerts" },
          ].map(item => (
            <div key={item.job} className="flex items-center justify-between py-1">
              <div>
                <p className="text-white/70 text-xs font-medium">{item.job}</p>
                <p className="text-white/25 text-[10px] font-mono">{item.endpoint}</p>
              </div>
              <span className="text-blue-400/70 text-xs font-mono">{item.schedule}</span>
            </div>
          ))}
        </div>
        <p className="text-white/20 text-xs mt-4">Requires CRON_SECRET env var set in Vercel. Cron jobs run at UTC times configured in vercel.json.</p>
      </div>

      {/* Webhook setup */}
      <div className="card-base p-5">
        <h3 className="section-title mb-3">Shopify Webhooks</h3>
        <p className="text-white/40 text-sm mb-3">Configure these webhooks in Shopify Admin → Settings → Notifications:</p>
        <div className="space-y-2 font-mono text-xs">
          {[
            { event: "Order creation", url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/orders` },
            { event: "Refund creation", url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify/refunds` },
          ].map(wh => (
            <div key={wh.event} className="bg-black/20 rounded-lg p-3">
              <p className="text-white/30 text-[10px] uppercase mb-1">{wh.event}</p>
              <p className="text-white/60">{wh.url}</p>
            </div>
          ))}
        </div>
        <p className="text-white/25 text-xs mt-2">Set WEBHOOK_SECRET in .env.local and in Shopify webhook settings.</p>
      </div>

      {/* 2FA */}
      <TwoFactorSetup
        isEnabled={profile?.totp_enabled ?? false}
        isAdmin={profile?.role === "admin"}
      />

      {/* Env reference */}
      <div className="card-base p-5">
        <h3 className="section-title mb-3">Environment Variables Reference</h3>
        <pre className="font-mono text-xs text-white/40 bg-black/20 rounded-lg p-4 overflow-x-auto leading-6 select-all">
{`# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=

# Shopify Store 1 (Partner Dashboard / Dev Dashboard app)
SHOPIFY_STORE_1_URL=theknockoutautomations.myshopify.com
SHOPIFY_STORE_1_CLIENT_ID=
SHOPIFY_STORE_1_CLIENT_SECRET=
SHOPIFY_STORE_1_NAME=TheKnockoutAutomations
# SHOPIFY_STORE_1_TOKEN=  ← legacy static token, no longer needed

# Shopify Store 2 (when ready)
SHOPIFY_STORE_2_URL=
SHOPIFY_STORE_2_TOKEN=
SHOPIFY_STORE_2_NAME=TheKnockoutAcademy

# Meta Ads
META_ADS_ACCESS_TOKEN=
META_ADS_ACCOUNT_ID=act_127055140796963

# Cashfree
CASHFREE_CLIENT_ID=
CASHFREE_CLIENT_SECRET=
CASHFREE_ENV=production

# Google (for GA4 + Drive)
GOOGLE_SERVICE_ACCOUNT_KEY=
GA4_PROPERTY_ID=
GOOGLE_DRIVE_FOLDER_ID=

# Email
RESEND_API_KEY=
NOTIFICATION_EMAIL=theknockoutacademy@gmail.com

# Security
CRON_SECRET=
WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=https://finance.tkoa.in`}
        </pre>
      </div>
    </div>
  );
}
