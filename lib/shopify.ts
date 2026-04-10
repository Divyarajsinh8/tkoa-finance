// Shopify multi-store integration
// Store 1: uses Client ID + Client Secret (Shopify Dev Dashboard / Partner App)
// Store 2: uses static access token (legacy shpat_ format)

export interface ShopifyStore {
  url: string;
  name: string;
  // New: OAuth client credentials (Partner Dashboard apps)
  clientId?: string;
  clientSecret?: string;
  // Legacy: static access token (Admin-created custom apps, shpat_...)
  token?: string;
}

// ── In-memory token cache ────────────────────────────────────────────────────
// Reuses exchanged tokens for 23 hours to avoid hitting the auth endpoint on
// every API call. TTL is deliberately under 24 h in case Shopify rotates tokens.

interface CachedToken {
  token: string;
  expiresAt: number; // Date.now() ms
}

const tokenCache = new Map<string, CachedToken>();
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours

/**
 * Return a valid access token for a store.
 * - Static token stores: returned directly.
 * - Client-credentials stores: cached exchange; re-exchanges when close to expiry.
 */
async function getAccessToken(store: ShopifyStore): Promise<string> {
  // Static token — no exchange needed
  if (store.token) return store.token;

  if (!store.clientId || !store.clientSecret) {
    throw new Error(`Shopify [${store.name}]: no token or client credentials configured`);
  }

  // Check cache
  const cacheKey = `${store.url}::${store.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  // Exchange client credentials for an access token
  const res = await fetch(`https://${store.url}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: store.clientId,
      client_secret: store.clientSecret,
      grant_type: "client_credentials",
    }),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Shopify auth failed [${store.name}]: ${res.status} — ${body}`);
  }

  const data = await res.json();
  const token: string = data.access_token;
  if (!token) throw new Error(`Shopify auth [${store.name}]: empty access_token in response`);

  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

// ── Store configuration ──────────────────────────────────────────────────────

export function getShopifyStores(): ShopifyStore[] {
  const stores: ShopifyStore[] = [];

  // Store 1 — prefer client credentials, fall back to static token
  if (process.env.SHOPIFY_STORE_1_URL) {
    if (process.env.SHOPIFY_STORE_1_CLIENT_ID && process.env.SHOPIFY_STORE_1_CLIENT_SECRET) {
      stores.push({
        url: process.env.SHOPIFY_STORE_1_URL,
        name: process.env.SHOPIFY_STORE_1_NAME || "Store1",
        clientId: process.env.SHOPIFY_STORE_1_CLIENT_ID,
        clientSecret: process.env.SHOPIFY_STORE_1_CLIENT_SECRET,
      });
    } else if (process.env.SHOPIFY_STORE_1_TOKEN) {
      // Legacy fallback — static token still works
      stores.push({
        url: process.env.SHOPIFY_STORE_1_URL,
        name: process.env.SHOPIFY_STORE_1_NAME || "Store1",
        token: process.env.SHOPIFY_STORE_1_TOKEN,
      });
    }
  }

  // Store 2 — static token (not yet migrated)
  if (process.env.SHOPIFY_STORE_2_URL && process.env.SHOPIFY_STORE_2_TOKEN) {
    stores.push({
      url: process.env.SHOPIFY_STORE_2_URL,
      name: process.env.SHOPIFY_STORE_2_NAME || "Store2",
      token: process.env.SHOPIFY_STORE_2_TOKEN,
    });
  }

  // Legacy single-store env vars
  if (stores.length === 0 && process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
    stores.push({
      url: process.env.SHOPIFY_STORE_URL,
      name: "TheKnockoutAutomations",
      token: process.env.SHOPIFY_ACCESS_TOKEN,
    });
  }

  return stores;
}

// ── Shopify types ────────────────────────────────────────────────────────────

export interface ShopifyOrder {
  id: string;
  order_number: number;
  email: string;
  customer?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    orders_count: number;
    total_spent: string;
    created_at: string;
    addresses?: { city: string; province: string; country: string }[];
    tags: string;
  };
  total_price: string;
  subtotal_price: string;
  total_discounts: string;
  total_tax: string;
  total_shipping_price_set?: { shop_money?: { amount: string } };
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  payment_gateway: string;
  line_items: {
    id: string;
    title: string;
    quantity: number;
    price: string;
    sku: string;
    variant_title: string;
    product_id: string;
  }[];
  discount_codes: { code: string; amount: string; type: string }[];
  browser_ip: string;
  landing_site: string;
  referring_site: string;
  note_attributes?: { name: string; value: string }[];
  refunds: { refund_line_items: { subtotal: string }[]; transactions: { amount: string }[] }[];
  created_at: string;
  updated_at: string;
}

export interface ShopifyCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
  created_at: string;
  updated_at: string;
  last_order_id: string;
  last_order_name: string;
  tags: string;
  default_address?: {
    city: string;
    province: string;
    country: string;
  };
}

export interface ShopifyPayout {
  id: string;
  status: string;
  date: string;
  currency: string;
  amount: string;
  summary: {
    adjustments_fee_amount: string;
    adjustments_gross_amount: string;
    charges_fee_amount: string;
    charges_gross_amount: string;
    refunds_fee_amount: string;
    refunds_gross_amount: string;
    payout_fee_amount: string;
    net_sales_amount: string;
  };
}

// ── Core fetch helper ────────────────────────────────────────────────────────

async function shopifyFetch<T>(
  store: ShopifyStore,
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`https://${store.url}/admin/api/2024-01/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const token = await getAccessToken(store);

  const res = await fetch(url.toString(), {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Shopify API error [${store.name}]: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Order fetching (cursor-paginated) ────────────────────────────────────────

export async function fetchShopifyOrders(
  store: ShopifyStore,
  sinceDate?: string,
  pageInfo?: string
): Promise<{ orders: ShopifyOrder[]; nextPageInfo?: string }> {
  const params: Record<string, string> = {
    limit: "250",
    status: "any",
  };
  if (sinceDate) params.created_at_min = sinceDate;
  if (pageInfo) params.page_info = pageInfo;

  const token = await getAccessToken(store);

  const res = await fetch(
    `https://${store.url}/admin/api/2024-01/orders.json?${new URLSearchParams(params)}`,
    {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) throw new Error(`Shopify orders error [${store.name}]: ${res.statusText}`);

  // Extract next page info from Link header
  const linkHeader = res.headers.get("Link");
  let nextPageInfo: string | undefined;
  if (linkHeader) {
    const nextMatch = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    if (nextMatch) nextPageInfo = nextMatch[1];
  }

  const data = await res.json();
  return { orders: data.orders || [], nextPageInfo };
}

export async function fetchAllShopifyOrders(
  store: ShopifyStore,
  sinceDate?: string
): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = [];
  let pageInfo: string | undefined;

  do {
    const { orders, nextPageInfo } = await fetchShopifyOrders(store, sinceDate, pageInfo);
    allOrders.push(...orders);
    pageInfo = nextPageInfo;
    if (pageInfo) await new Promise(r => setTimeout(r, 500)); // rate-limit respect
  } while (pageInfo);

  return allOrders;
}

export async function fetchShopifyCustomers(
  store: ShopifyStore,
  sinceDate?: string
): Promise<ShopifyCustomer[]> {
  const params: Record<string, string> = { limit: "250" };
  if (sinceDate) params.updated_at_min = sinceDate;

  const data = await shopifyFetch<{ customers: ShopifyCustomer[] }>(
    store,
    "customers.json",
    params
  );
  return data.customers || [];
}

export async function fetchShopifyPayouts(
  store: ShopifyStore,
  sinceDate?: string
): Promise<ShopifyPayout[]> {
  try {
    const params: Record<string, string> = { limit: "250" };
    if (sinceDate) params.date_min = sinceDate;

    const data = await shopifyFetch<{ payouts: ShopifyPayout[] }>(
      store,
      "shopify_payments/payouts.json",
      params
    );
    return data.payouts || [];
  } catch {
    // Shopify Payments not enabled for this store
    return [];
  }
}

// ── DB row mappers ───────────────────────────────────────────────────────────

export function orderToDbRow(order: ShopifyOrder, storeName: string) {
  const isNewCustomer = order.customer?.orders_count === 1 || !order.customer;
  const discountCode = order.discount_codes?.[0]?.code ?? null;
  const shippingAmount = order.total_shipping_price_set?.shop_money
    ? Math.round(parseFloat(order.total_shipping_price_set.shop_money.amount) * 100)
    : 0;

  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;

  if (order.note_attributes) {
    for (const attr of order.note_attributes) {
      if (attr.name === "utm_source") utmSource = attr.value;
      if (attr.name === "utm_medium") utmMedium = attr.value;
      if (attr.name === "utm_campaign") utmCampaign = attr.value;
    }
  }

  if (!utmSource && order.landing_site) {
    try {
      const url = new URL(
        order.landing_site.startsWith("http")
          ? order.landing_site
          : `https://example.com${order.landing_site}`
      );
      utmSource = url.searchParams.get("utm_source");
      utmMedium = url.searchParams.get("utm_medium");
      utmCampaign = url.searchParams.get("utm_campaign");
    } catch { /* ignore */ }
  }

  return {
    store: storeName,
    shopify_order_id: order.id.toString(),
    order_number: `#${order.order_number}`,
    customer_email: order.email || order.customer?.email || null,
    customer_name: order.customer
      ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
      : null,
    is_new_customer: isNewCustomer,
    total_amount: Math.round(parseFloat(order.total_price) * 100),
    subtotal: Math.round(parseFloat(order.subtotal_price) * 100),
    discount_amount: Math.round(parseFloat(order.total_discounts || "0") * 100),
    discount_code: discountCode,
    tax_amount: Math.round(parseFloat(order.total_tax || "0") * 100),
    shipping_amount: shippingAmount,
    currency: order.currency,
    payment_status: order.financial_status,
    fulfillment_status: order.fulfillment_status || "unfulfilled",
    payment_gateway: order.payment_gateway,
    line_items: order.line_items,
    browser_ip: order.browser_ip || null,
    landing_page: order.landing_site || null,
    referring_site: order.referring_site || null,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    created_at: order.created_at,
  };
}

export function customerToDbRow(customer: ShopifyCustomer, storeName: string) {
  const addr = customer.default_address;
  return {
    store: storeName,
    shopify_customer_id: customer.id.toString(),
    email: customer.email,
    name: `${customer.first_name} ${customer.last_name}`.trim(),
    orders_count: customer.orders_count,
    total_spent: Math.round(parseFloat(customer.total_spent || "0") * 100),
    first_order_date: customer.created_at,
    last_order_date: customer.updated_at,
    tags: customer.tags ? customer.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
    city: addr?.city || null,
    state: addr?.province || null,
    country: addr?.country || null,
  };
}

export function payoutToDbRow(payout: ShopifyPayout, storeName: string) {
  const grossAmount = Math.round(parseFloat(payout.amount) * 100);
  const fees = payout.summary
    ? Math.round(
        (parseFloat(payout.summary.charges_fee_amount || "0") +
          parseFloat(payout.summary.refunds_fee_amount || "0") +
          parseFloat(payout.summary.payout_fee_amount || "0")) *
          100
      )
    : 0;

  return {
    store: storeName,
    payout_id: payout.id.toString(),
    amount: grossAmount,
    fees,
    net_amount: grossAmount - fees,
    status: payout.status,
    date: payout.date,
  };
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

export async function fetchShopifyOrders_legacy(sinceDate?: string): Promise<ShopifyOrder[]> {
  const stores = getShopifyStores();
  if (stores.length === 0) throw new Error("Shopify credentials not configured");
  return fetchAllShopifyOrders(stores[0], sinceDate);
}

export async function getShopifyRevenue(month: Date): Promise<number> {
  const stores = getShopifyStores();
  if (stores.length === 0) return 0;

  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  let total = 0;
  for (const store of stores) {
    const orders = await fetchAllShopifyOrders(store, startOfMonth.toISOString());
    total += orders
      .filter(o => {
        const date = new Date(o.created_at);
        return date >= startOfMonth && date <= endOfMonth && o.financial_status === "paid";
      })
      .reduce((sum, o) => sum + Math.round(parseFloat(o.total_price) * 100), 0);
  }
  return total;
}
