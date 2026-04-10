// Cashfree Payments API integration
// API docs: https://docs.cashfree.com/reference

const PROD_BASE = "https://api.cashfree.com/pg";
const SANDBOX_BASE = "https://sandbox.cashfree.com/pg";

function getBaseUrl() {
  return process.env.CASHFREE_ENV === "production" ? PROD_BASE : SANDBOX_BASE;
}

async function cashfreeFetch<T>(
  endpoint: string,
  params?: Record<string, string>,
  method = "GET"
): Promise<T> {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Cashfree credentials not configured");

  const url = new URL(`${getBaseUrl()}${endpoint}`);
  if (params && method === "GET") {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-api-version": "2023-08-01",
      "Content-Type": "application/json",
    },
    body: method !== "GET" && params ? JSON.stringify(params) : undefined,
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cashfree API error: ${res.status} — ${err}`);
  }
  return res.json();
}

export interface CashfreeOrder {
  cf_order_id: string;
  order_id: string;
  entity: string;
  order_currency: string;
  order_amount: number;
  order_status: string;
  order_expiry_time: string;
  customer_details: {
    customer_id: string;
    customer_email: string;
    customer_phone: string;
  };
  order_meta?: {
    return_url?: string;
    notify_url?: string;
  };
  created_at: string;
}

export interface CashfreePayment {
  cf_payment_id: number;
  order_amount: number;
  order_id: string;
  payment_amount: number;
  payment_currency: string;
  payment_status: string; // SUCCESS, FAILED, USER_DROPPED, PENDING
  payment_message: string;
  payment_time: string;
  payment_method: {
    card?: { card_number: string; card_network: string; card_type: string; card_bank_name: string };
    upi?: { upi_id: string; channel: string };
    netbanking?: { netbanking_bank_code: string; netbanking_bank_name: string };
    wallet?: { channel: string; phone: string };
  };
}

export interface CashfreeSettlement {
  cf_settlement_id: number;
  order_id: string;
  order_amount: number;
  service_charge: number;
  service_tax: number;
  settlement_amount: number;
  transfer_id: number;
  transfer_time: string;
  transfer_utr: string;
}

export async function fetchCashfreeOrders(
  fromDate: string,
  toDate: string,
  cursor?: string
): Promise<{ data: CashfreeOrder[]; cursor?: string }> {
  const params: Record<string, string> = {
    from_date: fromDate,
    to_date: toDate,
    count: "200",
  };
  if (cursor) params.cursor = cursor;

  const res = await cashfreeFetch<{ data: CashfreeOrder[]; cursor?: string }>(
    "/orders",
    params
  );
  return res;
}

export async function fetchAllCashfreeOrders(
  fromDate: string,
  toDate: string
): Promise<CashfreeOrder[]> {
  const allOrders: CashfreeOrder[] = [];
  let cursor: string | undefined;

  do {
    const res = await fetchCashfreeOrders(fromDate, toDate, cursor);
    allOrders.push(...(res.data || []));
    cursor = res.cursor;
    if (cursor) await new Promise(r => setTimeout(r, 300));
  } while (cursor);

  return allOrders;
}

export async function fetchCashfreePayments(orderId: string): Promise<CashfreePayment[]> {
  try {
    const res = await cashfreeFetch<CashfreePayment[]>(`/orders/${orderId}/payments`);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

export async function fetchCashfreeSettlements(
  fromDate: string,
  toDate: string
): Promise<CashfreeSettlement[]> {
  try {
    const res = await cashfreeFetch<{ data: CashfreeSettlement[] }>(
      "/settlement/batch",
      { from_date: fromDate, to_date: toDate }
    );
    return res.data || [];
  } catch {
    return [];
  }
}

export function paymentToDbRow(order: CashfreeOrder, payment?: CashfreePayment, settlement?: CashfreeSettlement) {
  let paymentMethod: string | null = null;
  let cardNetwork: string | null = null;
  let bankName: string | null = null;
  let upiId: string | null = null;

  if (payment?.payment_method) {
    const m = payment.payment_method;
    if (m.card) {
      paymentMethod = "card";
      cardNetwork = m.card.card_network;
      bankName = m.card.card_bank_name;
    } else if (m.upi) {
      paymentMethod = "upi";
      upiId = m.upi.upi_id;
    } else if (m.netbanking) {
      paymentMethod = "netbanking";
      bankName = m.netbanking.netbanking_bank_name;
    } else if (m.wallet) {
      paymentMethod = "wallet";
    }
  }

  return {
    cf_order_id: order.cf_order_id,
    cf_payment_id: payment?.cf_payment_id?.toString() || null,
    order_amount: Math.round(order.order_amount * 100), // paise
    payment_amount: payment ? Math.round(payment.payment_amount * 100) : null,
    payment_status: payment?.payment_status || order.order_status,
    payment_method: paymentMethod,
    card_network: cardNetwork,
    bank_name: bankName,
    upi_id: upiId,
    payment_time: payment?.payment_time || order.created_at,
    settlement_id: settlement?.cf_settlement_id?.toString() || null,
    settlement_amount: settlement ? Math.round(settlement.settlement_amount * 100) : null,
    settlement_date: settlement?.transfer_time ? settlement.transfer_time.split("T")[0] : null,
    customer_email: order.customer_details?.customer_email || null,
    customer_phone: order.customer_details?.customer_phone || null,
  };
}
