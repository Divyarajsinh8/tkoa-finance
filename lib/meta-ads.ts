// Meta Ads API integration (Facebook + Instagram)
// Uses Marketing API v19.0

const BASE_URL = "https://graph.facebook.com/v19.0";

export interface MetaAdInsight {
  date_start: string;
  date_stop: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id?: string;
  ad_name?: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  inline_link_clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  video_p25_watched_actions?: { action_type: string; value: string }[];
  video_p50_watched_actions?: { action_type: string; value: string }[];
  video_p75_watched_actions?: { action_type: string; value: string }[];
  video_p100_watched_actions?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}

const INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "reach",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "cpc",
  "cpm",
  "frequency",
  "actions",
  "action_values",
  "purchase_roas",
  "cost_per_action_type",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
].join(",");

function getActionValue(
  actions: { action_type: string; value: string }[] | undefined,
  type: string
): number {
  return parseFloat(actions?.find(a => a.action_type === type)?.value || "0");
}

async function metaFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) throw new Error("META_ADS_ACCESS_TOKEN not configured");

  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("access_token", token);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta API error: ${res.status} — ${err}`);
  }
  return res.json();
}

export async function fetchMetaInsights(
  dateStart: string,
  dateStop: string,
  level: "ad" | "adset" | "campaign" = "ad"
): Promise<MetaAdInsight[]> {
  const accountId = process.env.META_ADS_ACCOUNT_ID;
  if (!accountId) throw new Error("META_ADS_ACCOUNT_ID not configured");

  const allInsights: MetaAdInsight[] = [];

  // Initial request to create async job
  const jobRes = await metaFetch<{ report_run_id: string }>(
    `${accountId}/insights`,
    {
      fields: INSIGHT_FIELDS,
      time_range: JSON.stringify({ since: dateStart, until: dateStop }),
      level,
      time_increment: "1",
      limit: "500",
      async: "true",
    }
  );

  if (!jobRes.report_run_id) {
    // Synchronous response (small datasets)
    const syncRes = await metaFetch<{ data: MetaAdInsight[]; paging?: { next?: string } }>(
      `${accountId}/insights`,
      {
        fields: INSIGHT_FIELDS,
        time_range: JSON.stringify({ since: dateStart, until: dateStop }),
        level,
        time_increment: "1",
        limit: "500",
      }
    );
    return syncRes.data || [];
  }

  // Poll for async job completion
  const reportId = jobRes.report_run_id;
  let attempts = 0;
  while (attempts < 20) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await metaFetch<{ id: string; async_status: string; async_percent_completion: number }>(
      reportId,
      {}
    );

    if (statusRes.async_status === "Job Completed") break;
    if (statusRes.async_status === "Job Failed") throw new Error("Meta insights job failed");
    attempts++;
  }

  // Fetch paginated results
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { limit: "500" };
    if (cursor) params.after = cursor;

    const page = await metaFetch<{
      data: MetaAdInsight[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(`${reportId}/insights`, params);

    allInsights.push(...(page.data || []));
    cursor = page.paging?.next ? page.paging?.cursors?.after : undefined;
  } while (cursor);

  return allInsights;
}

// Convert Meta insight to DB row(s) — one row per date/campaign/adset/ad combo
export function insightToDbRow(insight: MetaAdInsight) {
  const spend = Math.round(parseFloat(insight.spend || "0") * 100); // paise
  const cpc = Math.round(parseFloat(insight.cpc || "0") * 100);
  const cpm = Math.round(parseFloat(insight.cpm || "0") * 100);

  const conversions = getActionValue(insight.actions, "purchase") +
    getActionValue(insight.actions, "offsite_conversion.fb_pixel_purchase");

  const conversionValue = Math.round(
    (getActionValue(insight.action_values, "purchase") +
      getActionValue(insight.action_values, "offsite_conversion.fb_pixel_purchase")) * 100
  );

  const roas = insight.purchase_roas?.[0]?.value
    ? parseFloat(insight.purchase_roas[0].value)
    : conversionValue > 0 && spend > 0
    ? conversionValue / spend
    : 0;

  const addToCarts = getActionValue(insight.actions, "add_to_cart");
  const checkouts = getActionValue(insight.actions, "initiate_checkout");

  const costPerConversion = conversions > 0 ? Math.round(spend / conversions) : 0;

  const videoViews25 = getActionValue(insight.video_p25_watched_actions, "video_view");
  const videoViews50 = getActionValue(insight.video_p50_watched_actions, "video_view");
  const videoViews75 = getActionValue(insight.video_p75_watched_actions, "video_view");
  const videoViews100 = getActionValue(insight.video_p100_watched_actions, "video_view");

  return {
    date: insight.date_start,
    campaign_id: insight.campaign_id,
    campaign_name: insight.campaign_name,
    adset_id: insight.adset_id,
    adset_name: insight.adset_name,
    ad_id: insight.ad_id || null,
    ad_name: insight.ad_name || null,
    spend,
    impressions: parseInt(insight.impressions || "0"),
    reach: parseInt(insight.reach || "0"),
    clicks: parseInt(insight.clicks || "0"),
    link_clicks: parseInt(insight.inline_link_clicks || "0"),
    ctr: parseFloat(insight.ctr || "0"),
    cpc,
    cpm,
    conversions: Math.round(conversions),
    conversion_value: conversionValue,
    roas: parseFloat(roas.toFixed(2)),
    cost_per_conversion: costPerConversion,
    add_to_carts: Math.round(addToCarts),
    checkouts_initiated: Math.round(checkouts),
    frequency: parseFloat(insight.frequency || "0"),
    video_views_25: Math.round(videoViews25),
    video_views_50: Math.round(videoViews50),
    video_views_75: Math.round(videoViews75),
    video_views_100: Math.round(videoViews100),
  };
}

// Get date range for last N days
export function getDateRange(daysBack: number): { dateStart: string; dateStop: string } {
  const now = new Date();
  const stop = new Date(now);
  stop.setDate(stop.getDate() - 1); // yesterday

  const start = new Date(stop);
  start.setDate(start.getDate() - (daysBack - 1));

  return {
    dateStart: start.toISOString().split("T")[0],
    dateStop: stop.toISOString().split("T")[0],
  };
}
