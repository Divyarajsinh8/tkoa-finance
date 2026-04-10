import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyTOTP } from "@/lib/totp";

// DELETE → disable 2FA (requires verification)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();

  const { data: profile } = await supabase
    .from("users")
    .select("totp_secret, totp_enabled, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  if (!profile?.totp_enabled) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  if (!profile?.totp_secret || !verifyTOTP(token, profile.totp_secret)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  await supabase
    .from("users")
    .update({ totp_enabled: false, totp_secret: null })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
