import { createClient } from "@/lib/supabase/server";
import { BriefingClient } from "./BriefingClient";

export default async function BriefingPage() {
  const supabase = await createClient();

  const { data: briefings } = await supabase
    .from("ai_briefings")
    .select("*")
    .order("date", { ascending: false })
    .limit(7);

  return <BriefingClient briefings={briefings || []} />;
}
