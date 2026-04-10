-- ============================================================
-- TKOA Finance — Phase 4 Migration
-- Run this in Supabase SQL Editor after schema-v2
-- ============================================================

-- 2FA columns on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;

-- Bank reconciliation: match confidence score
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(3,2);

-- Budget alerts dedupe key (prevent duplicate alerts per category/month)
ALTER TABLE ai_alerts ADD COLUMN IF NOT EXISTS dedup_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_alerts_dedup ON ai_alerts(dedup_key) WHERE dedup_key IS NOT NULL AND is_dismissed = false;

-- Index for budget alert queries
CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
