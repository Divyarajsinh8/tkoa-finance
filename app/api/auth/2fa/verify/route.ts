import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyTOTP } from "@/lib/totp";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, enableAfterVerify } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("totp_secret, totp_enabled")
    .eq("id", user.id)
    .single();

  if (!profile?.totp_secret) {
    return NextResponse.json({ error: "No 2FA secret configured" }, { status: 400 });
  }

  const valid = verifyTOTP(token.replace(/\s/g, ""), profile.totp_secret);
  if (!valid) {
    return NextResponse.json({ error: "Invalid code. Check your authenticator app." }, { status: 401 });
  }

  // If called from setup flow, activate 2FA
  if (enableAfterVerify) {
    await supabase
      .from("users")
      .update({ totp_enabled: true })
      .eq("id", user.id);
  }

  return NextResponse.json({ success: true });
}
