import { NextResponse } from "next/server";

// Unified sync endpoint — fires all integrations in parallel
// Called by Vercel cron every 4 hours

function verifyCronSecret(req: Request): boolean {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return secret === process.env.CRON_SECRET || process.env.NODE_ENV === "development";
}

async function callSync(url: string, cronSecret: string): Promise<{ source: string; result: unknown; ok: boolean }> {
  const source = url.split("/").pop() || url;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-cron-secret": cronSecret,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    return { source, result: data, ok: res.ok };
  } catch (err) {
    return { source, result: { error: String(err) }, ok: false };
  }
}

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET || "";

  const syncEndpoints = [
    `${appUrl}/api/sync/shopify`,
    `${appUrl}/api/sync/meta-ads`,
    `${appUrl}/api/sync/cashfree`,
    `${appUrl}/api/sync/ga4`,
  ];

  const results = await Promise.allSettled(
    syncEndpoints.map(url => callSync(url, cronSecret))
  );

  const summary = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return { source: syncEndpoints[i], result: { error: r.reason }, ok: false };
  });

  // After data sync, run anomaly check
  try {
    await fetch(`${appUrl}/api/ai/anomaly-check`, {
      method: "POST",
      headers: { "x-cron-secret": cronSecret },
    });
  } catch { /* non-blocking */ }

  return NextResponse.json({ success: true, syncs: summary, timestamp: new Date().toISOString() });
}

export async function GET(req: Request) {
  return POST(req);
}
