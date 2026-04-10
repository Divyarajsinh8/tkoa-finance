const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

interface ShopifyOrder {
  id: string;
  email: string;
  total_price: string;
  created_at: string;
  financial_status: string;
  refunds: { amount: string }[];
}

export async function fetchShopifyOrders(
  sinceDate?: string
): Promise<ShopifyOrder[]> {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error("Shopify credentials not configured");
  }

  const params = new URLSearchParams({
    limit: "250",
    status: "any",
  });
  if (sinceDate) params.append("created_at_min", sinceDate);

  const res = await fetch(
    `https://${SHOPIFY_STORE_URL}/admin/api/2024-01/orders.json?${params}`,
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) throw new Error(`Shopify API error: ${res.statusText}`);

  const data = await res.json();
  return data.orders;
}

export async function getShopifyRevenue(month: Date): Promise<number> {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const orders = await fetchShopifyOrders(startOfMonth.toISOString());

  return orders
    .filter((o) => {
      const date = new Date(o.created_at);
      return (
        date >= startOfMonth &&
        date <= endOfMonth &&
        o.financial_status === "paid"
      );
    })
    .reduce((sum, o) => sum + Math.round(parseFloat(o.total_price) * 100), 0);
}
