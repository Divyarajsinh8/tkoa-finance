import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const supabase = await createClient();

  const { data: briefings } = await supabase
    .from("ai_briefings")
    .select("date, content, sent_at")
    .order("date", { ascending: false })
    .limit(30);

  return <ReportsClient briefings={briefings || []} />;
}
