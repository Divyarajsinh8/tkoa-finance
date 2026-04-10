// Shopify multi-store integration
// Supports TheKnockoutAutomations + TheKnockoutAcademy

export interface ShopifyStore {
  url: string;
  token: string;
  name: string;
}

export function getShopifyStores(): ShopifyStore[] {
  const stores: ShopifyStore[] = [];

  if (process.env.SHOPIFY_STORE_1_URL && process.env.SHOPIFY_STORE_1_TOKEN) {
    stores.push({
      url: process.env.SHOPIFY_STORE_1_URL,
      token: process.env.SHOPIFY_STORE_1_TOKEN,
      name: process.env.SHOPIFY_STORE_1_NAME || "Store1",
    });
  }
  if (process.env.SHOPIFY_STORE_2_URL && process.env.SHOPIFY_STORE_2_TOKEN) {
    stores.push({
      url: process.env.SHOPIFY_STORE_2_URL,
      token: process.env.SHOPIFY_STORE_2_TOKEN,
      name: process.env.SHOPIFY_STORE_2_NAME || "Store2",
    });
  }
  // Fallback to legacy single-store env vars
  if (stores.length === 0 && process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
    stores.push({
      url: process.env.SHOPIFY_STORE_URL,
      token: process.env.SHOPIFY_ACCESS_TOKEN,
      name: "TheKnockoutAutomations",
    });
  }
  return stores;
}

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

async function shopifyFetch<T>(
  store: ShopifyStore,
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`https://${store.url}/admin/api/2024-01/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-Shopify-Access-Token": store.token,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Shopify API error [${store.name}]: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

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

  const res = await fetch(
    `https://${store.url}/admin/api/2024-01/orders.json?${new URLSearchParams(params)}`,
    {
      headers: {
        "X-Shopify-Access-Token": store.token,
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
    if (pageInfo) await new Promise(r => setTimeout(r, 500)); // rate limit respect
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

// Convert Shopify order to DB row
export function orderToDbRow(order: ShopifyOrder, storeName: string) {
  const isNewCustomer =
    order.customer?.orders_count === 1 || !order.customer;

  const discountCode =
    order.discount_codes?.[0]?.code ?? null;

  const shippingAmount = order.total_shipping_price_set?.shop_money
    ? Math.round(parseFloat(order.total_shipping_price_set.shop_money.amount) * 100)
    : 0;

  // Extract UTM params from note_attributes or landing_site
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

  // Parse from landing_site URL if not in note_attributes
  if (!utmSource && order.landing_site) {
    try {
      const url = new URL(order.landing_site.startsWith("http") ? order.landing_site : `https://example.com${order.landing_site}`);
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

// Legacy compat — kept for existing /api/shopify/sync route
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
      .filter((o) => {
        const date = new Date(o.created_at);
        return date >= startOfMonth && date <= endOfMonth && o.financial_status === "paid";
      })
      .reduce((sum, o) => sum + Math.round(parseFloat(o.total_price) * 100), 0);
  }
  return total;
}
