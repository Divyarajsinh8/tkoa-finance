import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("*").single();

  return (
    <div className="max-w-2xl space-y-5">
      <h2 className="page-title text-xl">Settings</h2>

      {/* Profile */}
      <div className="card-base p-6 space-y-4">
        <h3 className="section-title">Profile</h3>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#DC3C3C]/20 flex items-center justify-center">
            <span className="text-[#DC3C3C] text-2xl font-bold">{profile?.full_name?.[0] ?? "U"}</span>
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{profile?.full_name ?? "User"}</p>
            <p className="text-white/50 text-sm">{user?.email}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#DC3C3C]/20 text-[#DC3C3C] font-medium capitalize">{profile?.role}</span>
          </div>
        </div>
      </div>

      {/* Integration Status */}
      <div className="card-base p-6 space-y-3">
        <h3 className="section-title">Integrations</h3>
        {[
          { name: "Supabase", desc: "Database & Auth", status: "connected" },
          { name: "Anthropic Claude", desc: "Invoice OCR & AI Advisor", status: process.env.NEXT_PUBLIC_HAS_ANTHROPIC ? "connected" : "configure" },
          { name: "Shopify", desc: "Orders & Revenue sync", status: process.env.NEXT_PUBLIC_HAS_SHOPIFY ? "connected" : "configure" },
          { name: "Google Drive", desc: "Invoice file storage", status: process.env.NEXT_PUBLIC_HAS_GDRIVE ? "connected" : "configure" },
        ].map(({ name, desc, status }) => (
          <div key={name} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
            <div>
              <p className="text-white/80 font-medium text-sm">{name}</p>
              <p className="text-white/35 text-xs">{desc}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              status === "connected"
                ? "bg-green-400/10 text-green-400"
                : "bg-yellow-400/10 text-yellow-400"
            }`}>
              {status === "connected" ? "Connected" : "Configure"}
            </span>
          </div>
        ))}
      </div>

      {/* Env Variables Guide */}
      <div className="card-base p-6">
        <h3 className="section-title mb-3">Environment Variables</h3>
        <p className="text-white/40 text-sm mb-3">Set these in your <code className="font-mono text-white/60 bg-white/[0.05] px-1 py-0.5 rounded">.env.local</code> file:</p>
        <pre className="font-mono text-xs text-white/50 bg-black/20 rounded-lg p-4 overflow-x-auto leading-6">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=

GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY=
GOOGLE_DRIVE_FOLDER_ID=

SHOPIFY_STORE_URL=
SHOPIFY_ACCESS_TOKEN=`}
        </pre>
      </div>
    </div>
  );
}
