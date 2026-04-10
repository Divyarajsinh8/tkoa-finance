// Google Analytics 4 Data API integration
// Uses GA4 Data API v1 with service account authentication

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const keyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyStr) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");

  const key: ServiceAccountKey = JSON.parse(keyStr);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Create JWT (Node.js crypto)
  const { createSign } = await import("crypto");

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const unsigned = `${encode(header)}.${encode(payload)}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(key.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google token error: ${await tokenRes.text()}`);
  }

  const tokenData = await tokenRes.json();
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };
  return cachedToken.token;
}

interface GA4Row {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

interface GA4Response {
  rows?: GA4Row[];
  rowCount?: number;
}

async function ga4Fetch(
  propertyId: string,
  body: object
): Promise<GA4Response> {
  const token = await getAccessToken();
  // Remove "properties/" prefix if present for the path, then add back
  const propId = propertyId.replace("properties/", "");

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 API error: ${res.status} — ${err}`);
  }
  return res.json();
}

function metricVal(row: GA4Row, idx: number): number {
  return parseFloat(row.metricValues[idx]?.value || "0");
}

function dimVal(row: GA4Row, idx: number): string {
  return row.dimensionValues[idx]?.value || "";
}

export async function fetchGA4DailyData(
  propertyId: string,
  dateStart: string,
  dateStop: string
): Promise<ReturnType<typeof buildGA4DbRow>[]> {
  if (!propertyId || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("GA4 credentials not configured");
  }

  // Main metrics report
  const mainReport = await ga4Fetch(propertyId, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "screenPageViews" },
      { name: "averageSessionDuration" },
      { name: "bounceRate" },
      { name: "conversions" },
      { name: "sessionConversionRate" },
      { name: "purchaseRevenue" },
    ],
  });

  // Channel report
  const channelReport = await ga4Fetch(propertyId, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
  });

  // Device report
  const deviceReport = await ga4Fetch(propertyId, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "date" }, { name: "deviceCategory" }],
    metrics: [{ name: "sessions" }],
  });

  // Top pages (aggregated, not per day — take overall for the range)
  const pagesReport = await ga4Fetch(propertyId, {
    dateRanges: [{ startDate: dateStart, endDate: dateStop }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: "10",
  });

  const topPages = (pagesReport.rows || []).slice(0, 10).map(row => ({
    path: dimVal(row, 0),
    sessions: metricVal(row, 0),
    views: metricVal(row, 1),
  }));

  // Build channel map: { date -> { channel -> sessions } }
  const channelMap: Record<string, Record<string, number>> = {};
  for (const row of channelReport.rows || []) {
    const date = dimVal(row, 0);
    const channel = dimVal(row, 1).toLowerCase();
    if (!channelMap[date]) channelMap[date] = {};
    channelMap[date][channel] = (channelMap[date][channel] || 0) + metricVal(row, 0);
  }

  // Build device map
  const deviceMap: Record<string, Record<string, number>> = {};
  for (const row of deviceReport.rows || []) {
    const date = dimVal(row, 0);
    const device = dimVal(row, 1).toLowerCase();
    if (!deviceMap[date]) deviceMap[date] = {};
    deviceMap[date][device] = (deviceMap[date][device] || 0) + metricVal(row, 0);
  }

  // Normalize date from GA4 format (YYYYMMDD) to YYYY-MM-DD
  function normalizeDate(d: string): string {
    if (d.includes("-")) return d;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }

  // Build result rows
  return (mainReport.rows || []).map(row => {
    const date = normalizeDate(dimVal(row, 0));
    const channels = channelMap[dimVal(row, 0)] || {};
    const devices = deviceMap[dimVal(row, 0)] || {};

    return buildGA4DbRow({
      date,
      property: propertyId,
      sessions: metricVal(row, 0),
      users: metricVal(row, 1),
      newUsers: metricVal(row, 2),
      pageViews: metricVal(row, 3),
      avgSessionDuration: metricVal(row, 4),
      bounceRate: metricVal(row, 5) * 100, // convert to percentage
      conversions: metricVal(row, 6),
      conversionRate: metricVal(row, 7) * 100,
      revenue: metricVal(row, 8),
      organicSessions: channels["organic search"] || 0,
      paidSessions: channels["paid search"] || channels["paid social"] || 0,
      socialSessions: channels["organic social"] || 0,
      directSessions: channels["direct"] || 0,
      referralSessions: channels["referral"] || 0,
      emailSessions: channels["email"] || 0,
      mobileSessions: devices["mobile"] || 0,
      desktopSessions: devices["desktop"] || 0,
      tabletSessions: devices["tablet"] || 0,
      topPages,
    });
  });
}

function buildGA4DbRow(data: {
  date: string;
  property: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  organicSessions: number;
  paidSessions: number;
  socialSessions: number;
  directSessions: number;
  referralSessions: number;
  emailSessions: number;
  mobileSessions: number;
  desktopSessions: number;
  tabletSessions: number;
  topPages: object[];
}) {
  return {
    date: data.date,
    property: data.property,
    sessions: Math.round(data.sessions),
    users: Math.round(data.users),
    new_users: Math.round(data.newUsers),
    page_views: Math.round(data.pageViews),
    avg_session_duration: parseFloat(data.avgSessionDuration.toFixed(2)),
    bounce_rate: parseFloat(data.bounceRate.toFixed(2)),
    conversions: Math.round(data.conversions),
    conversion_rate: parseFloat(data.conversionRate.toFixed(3)),
    revenue: Math.round(data.revenue * 100), // paise
    organic_sessions: Math.round(data.organicSessions),
    paid_sessions: Math.round(data.paidSessions),
    social_sessions: Math.round(data.socialSessions),
    direct_sessions: Math.round(data.directSessions),
    referral_sessions: Math.round(data.referralSessions),
    email_sessions: Math.round(data.emailSessions),
    mobile_sessions: Math.round(data.mobileSessions),
    desktop_sessions: Math.round(data.desktopSessions),
    tablet_sessions: Math.round(data.tabletSessions),
    top_pages: data.topPages,
  };
}
