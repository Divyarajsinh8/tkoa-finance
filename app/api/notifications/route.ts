import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  const unreadOnly = url.searchParams.get("unread") === "true";

  if (!userId) {
    // Return AI alerts for the dashboard bell
    const { data: alerts } = await supabase
      .from("ai_alerts")
      .select("*")
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(20);

    const unreadCount = (alerts || []).filter(a => !a.is_read).length;
    return NextResponse.json({ alerts: alerts || [], unreadCount });
  }

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unreadCount = unreadOnly ? (data || []).length : (data || []).filter(n => !n.is_read).length;
  return NextResponse.json({ notifications: data || [], unreadCount });
}

export async function PATCH(req: Request) {
  const { ids, type, mark_read, dismiss } = await req.json();

  if (type === "alert") {
    const update: Record<string, boolean> = {};
    if (mark_read) update.is_read = true;
    if (dismiss) update.is_dismissed = true;

    if (ids?.length) {
      await supabase.from("ai_alerts").update(update).in("id", ids);
    } else {
      // Mark all read
      await supabase.from("ai_alerts").update(update).eq("is_read", false);
    }
  } else {
    if (ids?.length) {
      await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    }
  }

  return NextResponse.json({ success: true });
}
