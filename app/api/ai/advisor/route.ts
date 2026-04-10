import { NextRequest, NextResponse } from "next/server";
import { askAIAdvisor, generateInsights } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, financialContext } = await request.json();

  if (!question || !financialContext) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    if (question === "insights") {
      const insights = await generateInsights(financialContext);
      return NextResponse.json({ insights });
    }

    const answer = await askAIAdvisor(question, financialContext);
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("AI advisor error:", error);
    return NextResponse.json({ error: "AI processing failed" }, { status: 500 });
  }
}
