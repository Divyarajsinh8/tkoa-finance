import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";

export default async function AuditPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase.from("users").select("role").single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: logs } = await supabase
    .from("audit_log")
    .select("*, user:users(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  const actionColor: Record<string, string> = {
    create: "text-green-400 bg-green-400/10",
    update: "text-blue-400 bg-blue-400/10",
    delete: "text-red-400 bg-red-400/10",
  };

  return (
    <div className="max-w-5xl space-y-4">
      <h2 className="page-title text-xl">Audit Log</h2>

      <div className="card-base overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Time", "User", "Action", "Entity", "Details"].map(h => (
                <th key={h} className="text-left px-4 py-3 data-label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!logs || logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-white/20">No audit events recorded</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-2.5 font-mono text-white/30 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("en-IN", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 text-white/60">
                    {(log.user as { full_name?: string })?.full_name ?? "System"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("status-badge capitalize", actionColor[log.action] ?? "text-white/40 bg-white/5")}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/50 capitalize">{log.entity_type}</td>
                  <td className="px-4 py-2.5 text-white/30 font-mono text-[10px] truncate max-w-[200px]">
                    {log.entity_id?.slice(0, 8)}…
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
