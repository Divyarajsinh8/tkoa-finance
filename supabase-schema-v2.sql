-- ============================================================
-- TKOA Finance Command Center — Schema V2 Migration
-- Run this AFTER the base schema (supabase-schema.sql)
-- Run in Supabase SQL Editor
-- ============================================================

-- ========================
-- SHOPIFY ORDERS
-- ========================
CREATE TABLE IF NOT EXISTS shopify_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store TEXT NOT NULL,
  shopify_order_id TEXT UNIQUE NOT NULL,
  order_number TEXT,
  customer_email TEXT,
  customer_name TEXT,
  is_new_customer BOOLEAN DEFAULT true,
  total_amount INTEGER NOT NULL, -- paise
  subtotal INTEGER,
  discount_amount INTEGER DEFAULT 0,
  discount_code TEXT,
  tax_amount INTEGER DEFAULT 0,
  shipping_amount INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  payment_status TEXT,
  fulfillment_status TEXT,
  payment_gateway TEXT,
  line_items JSONB,
  browser_ip TEXT,
  landing_page TEXT,
  referring_site TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_store ON shopify_orders(store);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_created_at ON shopify_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_payment_status ON shopify_orders(payment_status);

-- ========================
-- SHOPIFY CUSTOMERS
-- ========================
CREATE TABLE IF NOT EXISTS shopify_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store TEXT NOT NULL,
  shopify_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  orders_count INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0, -- paise
  first_order_date TIMESTAMPTZ,
  last_order_date TIMESTAMPTZ,
  tags TEXT[],
  city TEXT,
  state TEXT,
  country TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopify_customers_store ON shopify_customers(store);
CREATE INDEX IF NOT EXISTS idx_shopify_customers_email ON shopify_customers(email);

-- ========================
-- SHOPIFY PAYOUTS
-- ========================
CREATE TABLE IF NOT EXISTS shopify_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store TEXT NOT NULL,
  payout_id TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL, -- paise
  fees INTEGER DEFAULT 0,
  net_amount INTEGER,
  status TEXT,
  date DATE,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- META ADS DAILY
-- ========================
CREATE TABLE IF NOT EXISTS meta_ads_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  spend INTEGER NOT NULL DEFAULT 0, -- paise
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  ctr DECIMAL(8,4),
  cpc INTEGER DEFAULT 0, -- paise
  cpm INTEGER DEFAULT 0, -- paise
  conversions INTEGER DEFAULT 0,
  conversion_value INTEGER DEFAULT 0, -- paise
  roas DECIMAL(8,2),
  cost_per_conversion INTEGER DEFAULT 0,
  add_to_carts INTEGER DEFAULT 0,
  checkouts_initiated INTEGER DEFAULT 0,
  frequency DECIMAL(5,2),
  video_views_25 INTEGER DEFAULT 0,
  video_views_50 INTEGER DEFAULT 0,
  video_views_75 INTEGER DEFAULT 0,
  video_views_100 INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, campaign_id, adset_id, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_date ON meta_ads_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON meta_ads_daily(campaign_id);

-- ========================
-- CASHFREE TRANSACTIONS
-- ========================
CREATE TABLE IF NOT EXISTS cashfree_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cf_order_id TEXT UNIQUE NOT NULL,
  cf_payment_id TEXT,
  order_amount INTEGER NOT NULL, -- paise
  payment_amount INTEGER,
  payment_status TEXT,
  payment_method TEXT,
  card_network TEXT,
  bank_name TEXT,
  upi_id TEXT,
  payment_time TIMESTAMPTZ,
  settlement_id TEXT,
  settlement_amount INTEGER,
  settlement_date DATE,
  customer_email TEXT,
  customer_phone TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cashfree_payment_time ON cashfree_transactions(payment_time DESC);
CREATE INDEX IF NOT EXISTS idx_cashfree_status ON cashfree_transactions(payment_status);

-- ========================
-- GA4 DAILY
-- ========================
CREATE TABLE IF NOT EXISTS ga4_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  property TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  avg_session_duration DECIMAL(8,2),
  bounce_rate DECIMAL(5,2),
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,3),
  revenue INTEGER DEFAULT 0, -- paise
  organic_sessions INTEGER DEFAULT 0,
  paid_sessions INTEGER DEFAULT 0,
  social_sessions INTEGER DEFAULT 0,
  direct_sessions INTEGER DEFAULT 0,
  referral_sessions INTEGER DEFAULT 0,
  email_sessions INTEGER DEFAULT 0,
  mobile_sessions INTEGER DEFAULT 0,
  desktop_sessions INTEGER DEFAULT 0,
  tablet_sessions INTEGER DEFAULT 0,
  top_pages JSONB,
  top_countries JSONB,
  top_cities JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, property)
);

CREATE INDEX IF NOT EXISTS idx_ga4_date ON ga4_daily(date DESC);

-- ========================
-- BANK TRANSACTIONS
-- ========================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_number_last4 TEXT,
  transaction_date DATE NOT NULL,
  value_date DATE,
  description TEXT,
  reference_number TEXT,
  debit_amount INTEGER DEFAULT 0, -- paise
  credit_amount INTEGER DEFAULT 0,
  balance INTEGER, -- paise
  matched_transaction_id UUID REFERENCES transactions(id),
  auto_category TEXT,
  status TEXT DEFAULT 'unmatched',
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_txn_date ON bank_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_txn_status ON bank_transactions(status);

-- ========================
-- AI BRIEFINGS
-- ========================
CREATE TABLE IF NOT EXISTS ai_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  content TEXT NOT NULL,
  data_snapshot JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- AI ALERTS
-- ========================
CREATE TABLE IF NOT EXISTS ai_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_alerts_created ON ai_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_unread ON ai_alerts(is_read, is_dismissed);

-- ========================
-- AI CATEGORY RULES
-- ========================
CREATE TABLE IF NOT EXISTS ai_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  confidence DECIMAL(3,2) DEFAULT 1.00,
  times_used INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- AI FORECASTS
-- ========================
CREATE TABLE IF NOT EXISTS ai_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL,
  period TEXT NOT NULL,
  forecast_date DATE NOT NULL,
  optimistic INTEGER,
  expected INTEGER,
  pessimistic INTEGER,
  assumptions JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- NOTIFICATIONS
-- ========================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ========================
-- GOALS & OKRS
-- ========================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  metric TEXT NOT NULL, -- 'revenue', 'orders', 'profit', 'roas', 'cac'
  period TEXT NOT NULL, -- 'monthly', 'quarterly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value INTEGER NOT NULL, -- paise or integer count
  current_value INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- SYNC LOG
-- ========================
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'shopify_store1', 'meta_ads', 'cashfree', 'ga4'
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_log_source ON sync_log(source, started_at DESC);

-- ========================
-- RLS FOR NEW TABLES
-- (Service role bypasses RLS — cron jobs use service role)
-- ========================

ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashfree_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view integration data
CREATE POLICY "Auth users view shopify_orders" ON shopify_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view shopify_customers" ON shopify_customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view shopify_payouts" ON shopify_payouts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view meta_ads" ON meta_ads_daily FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view cashfree" ON cashfree_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view ga4" ON ga4_daily FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view bank_transactions" ON bank_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view ai_briefings" ON ai_briefings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view ai_alerts" ON ai_alerts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view ai_forecasts" ON ai_forecasts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view goals" ON goals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users view sync_log" ON sync_log FOR SELECT USING (auth.role() = 'authenticated');

-- Managers+ can manage bank transactions and goals
CREATE POLICY "Managers can insert bank_transactions" ON bank_transactions FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "Admins manage goals" ON goals FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Notifications: users see their own
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System inserts notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- AI alerts: admins/managers can update (mark read/dismissed)
CREATE POLICY "Managers update ai_alerts" ON ai_alerts FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin', 'manager'));
CREATE POLICY "System insert ai_alerts" ON ai_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "System insert ai_category_rules" ON ai_category_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users view ai_category_rules" ON ai_category_rules FOR SELECT USING (auth.role() = 'authenticated');

-- Service role (used by cron/API routes) bypasses all RLS automatically
