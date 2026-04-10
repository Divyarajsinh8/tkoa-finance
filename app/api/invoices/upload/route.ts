import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Vercel: this route only uploads to storage — 30s is plenty
export const maxDuration = 30;

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "invoices";

async function ensureBucket() {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw new Error(`Storage bucket list failed: ${error.message}`);
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error: ce } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"],
    });
    if (ce) throw new Error(`Storage bucket creation failed: ${ce.message}`);
  }
}

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse form ────────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    return NextResponse.json({ error: `Bad request: ${String(e)}` }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const mimeType = file.type;
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
  if (!allowed.includes(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported type "${mimeType}". Upload PDF, JPEG, PNG, or WebP.` },
      { status: 400 }
    );
  }

  // ── Ensure bucket ─────────────────────────────────────────────────────────
  try {
    await ensureBucket();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[invoices/upload] bucket:", msg);
    return NextResponse.json({ error: `Storage setup failed: ${msg}` }, { status: 500 });
  }

  // ── Upload to storage ─────────────────────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { data: up, error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(fileName, buffer, { contentType: mimeType, upsert: false });

  if (upErr) {
    console.error("[invoices/upload] storage:", upErr.message);
    return NextResponse.json({ error: `File upload failed: ${upErr.message}` }, { status: 500 });
  }

  const body = { file_path: up.path, mime_type: mimeType };
  console.log("[invoices/upload] response:", JSON.stringify(body));
  return NextResponse.json(body);
}
