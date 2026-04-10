import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { processInvoice } from "@/lib/claude";

// Service-role client — needed for bucket creation and storage uploads
const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "invoices";

async function ensureBucket() {
  const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
  if (listErr) throw new Error(`Could not list storage buckets: ${listErr.message}`);

  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10 MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
    });
    if (createErr) throw new Error(`Could not create storage bucket: ${createErr.message}`);
  }
}

export async function POST(request: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse file
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    return NextResponse.json({ error: `Failed to parse form data: ${String(e)}` }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const mimeType = file.type;
  const supportedForAI = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const supportedForUpload = [...supportedForAI, "application/pdf"];

  if (!supportedForUpload.includes(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: "${mimeType}". Upload JPEG, PNG, WebP, or PDF.` },
      { status: 400 }
    );
  }

  // ── Step 1: Ensure storage bucket exists ───────────────────────────────────
  try {
    await ensureBucket();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[invoices/process] Bucket error:", msg);
    return NextResponse.json({ error: `Storage setup failed: ${msg}` }, { status: 500 });
  }

  // ── Step 2: Upload file to Supabase Storage ────────────────────────────────
  const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  let filePath: string;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, { contentType: mimeType, upsert: false });

    if (uploadErr) throw new Error(uploadErr.message);
    filePath = uploadData.path;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[invoices/process] Storage upload error:", msg);
    return NextResponse.json({ error: `File upload failed: ${msg}` }, { status: 500 });
  }

  // ── Step 3: AI extraction (best-effort — PDF falls back to manual) ─────────
  if (!supportedForAI.includes(mimeType)) {
    // PDF uploaded successfully but Claude can't read PDFs directly
    return NextResponse.json({
      ai_skipped: true,
      file_path: filePath,
      message: "PDF uploaded. Claude requires an image — enter invoice details manually below.",
    });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await processInvoice(buffer, mimeType);
    return NextResponse.json({ ai_data: extracted, file_path: filePath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[invoices/process] Claude API error:", msg);
    // File is already uploaded — tell the client so it can show manual fallback
    return NextResponse.json(
      {
        ai_failed: true,
        file_path: filePath,
        error: `AI extraction failed: ${msg}`,
      },
      { status: 200 } // 200 so client reads the body; ai_failed flag triggers manual form
    );
  }
}
