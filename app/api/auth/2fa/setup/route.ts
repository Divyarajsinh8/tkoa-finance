import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTOTPSecret, getTOTPUri, generateQRCode } from "@/lib/totp";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role, totp_enabled")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can enable 2FA" }, { status: 403 });
  }

  if (profile?.totp_enabled) {
    return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });
  }

  const secret = generateTOTPSecret();
  const uri = getTOTPUri(secret, user.email ?? "");
  const qrCode = await generateQRCode(uri);

  // Store the secret (not yet enabled — user must verify first)
  await supabase
    .from("users")
    .update({ totp_secret: secret })
    .eq("id", user.id);

  return NextResponse.json({ secret, qrCode });
}
