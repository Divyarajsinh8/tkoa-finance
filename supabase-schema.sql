-- ============================================================
-- TKOA Finance Command Center — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- USERS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- INVOICES TABLE (created before transactions for FK reference)
-- ========================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
  vendor TEXT NOT NULL,
  vendor_gstin TEXT,
  amount INTEGER NOT NULL,
  gst_amount INTEGER DEFAULT 0,
  date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  file_path TEXT,
  drive_file_id TEXT,
  drive_url TEXT,
  ai_extracted_data JSONB,
  category TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-increment invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- ========================
-- TRANSACTIONS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  sub_category TEXT,
  vendor TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL,
  gst_amount INTEGER DEFAULT 0,
  gst_rate DECIMAL(5,2),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'received', 'pending', 'overdue', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('credit_card', 'bank_transfer', 'upi', 'paypal', 'shopify_payments', 'cash')),
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  invoice_id UUID REFERENCES invoices(id),
  notes TEXT,
  tags TEXT[],
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-increment TXN ID function
CREATE OR REPLACE FUNCTION generate_txn_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.txn_id IS NULL OR NEW.txn_id = '' THEN
    NEW.txn_id := 'TXN-' || LPAD(nextval('txn_id_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS txn_id_seq START 1;

CREATE TRIGGER set_txn_id
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION generate_txn_id();

-- ========================
-- SUBSCRIPTIONS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT,
  cost INTEGER NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  next_due_date DATE,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'cancelled', 'free')),
  usage_notes TEXT,
  category TEXT,
  auto_renew BOOLEAN DEFAULT true,
  vendor_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- BUDGETS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  month DATE NOT NULL,
  budgeted_amount INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- AUDIT LOG TABLE
-- ========================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction', 'invoice', 'subscription', 'budget')),
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- ROW LEVEL SECURITY
-- ========================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- USERS policies
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Only admins can manage users" ON users FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- TRANSACTIONS policies
CREATE POLICY "All authenticated can view transactions" ON transactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can insert transactions" ON transactions
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Admins and managers can update transactions" ON transactions
  FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Only admins can delete transactions" ON transactions
  FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- INVOICES policies
CREATE POLICY "All authenticated can view invoices" ON invoices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can insert invoices" ON invoices
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Admins and managers can update invoices" ON invoices
  FOR UPDATE USING (get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Only admins can delete invoices" ON invoices
  FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- SUBSCRIPTIONS policies
CREATE POLICY "All authenticated can view subscriptions" ON subscriptions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage subscriptions" ON subscriptions
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- BUDGETS policies
CREATE POLICY "All authenticated can view budgets" ON budgets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can manage budgets" ON budgets
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- AUDIT LOG policies
CREATE POLICY "Only admins can view audit log" ON audit_log
  FOR SELECT USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "System can insert audit log" ON audit_log
  FOR INSERT WITH CHECK (true);

-- ========================
-- AUDIT TRIGGER FUNCTION
-- ========================
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_data)
    VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_data)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers
CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_subscriptions AFTER INSERT OR UPDATE OR DELETE ON subscriptions FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_budgets AFTER INSERT OR UPDATE OR DELETE ON budgets FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ========================
-- STORAGE BUCKET
-- ========================
-- Run in Supabase Dashboard > Storage > Create bucket named "invoices" (private)

-- ========================
-- INITIAL USERS (Run after creating auth users in Supabase Dashboard)
-- ========================
-- INSERT INTO users (id, email, full_name, role)
-- VALUES
--   ('<raj_auth_uuid>', 'theknockoutacademy@gmail.com', 'Raj', 'admin'),
--   ('<malav_auth_uuid>', '<malav_email>', 'Malav', 'manager');

-- ========================
-- SAMPLE DATA (Optional — remove before production)
-- ========================
-- Uncomment to seed test data:
/*
INSERT INTO subscriptions (name, plan, cost, billing_cycle, next_due_date, status, category) VALUES
  ('Vercel', 'Pro', 2000000, 'monthly', CURRENT_DATE + 10, 'active', 'Infrastructure'),
  ('Supabase', 'Pro', 2500000, 'monthly', CURRENT_DATE + 15, 'active', 'Infrastructure'),
  ('Claude API', 'Pay-as-you-go', 500000, 'monthly', CURRENT_DATE + 20, 'active', 'AI Tools'),
  ('Shopify', 'Basic', 2900000, 'monthly', CURRENT_DATE + 5, 'active', 'E-commerce'),
  ('Google Workspace', 'Starter', 500000, 'monthly', CURRENT_DATE + 8, 'active', 'Tools & Software');
*/
