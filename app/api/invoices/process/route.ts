import { NextRequest, NextResponse } from "next/server";
import { processInvoice } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mimeType = file.type;
  const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!supportedTypes.includes(mimeType)) {
    return NextResponse.json({
      error: "Only JPEG, PNG, GIF, and WebP images are supported for AI processing. Please convert PDF to image first.",
    }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await processInvoice(buffer, mimeType);
    return NextResponse.json(extracted);
  } catch (error) {
    console.error("Invoice processing error:", error);
    return NextResponse.json({ error: "AI processing failed" }, { status: 500 });
  }
}
