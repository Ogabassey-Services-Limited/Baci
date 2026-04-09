-- MyCover v2 Migration: Add columns for gadget insurance
-- Phase A: nullable columns only, no constraint changes

-- Add new columns to order_insurance_policies
ALTER TABLE order_insurance_policies
  ADD COLUMN IF NOT EXISTS policy_type TEXT,
  ADD COLUMN IF NOT EXISTS certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_name TEXT,
  ADD COLUMN IF NOT EXISTS mycover_product_id TEXT,
  ADD COLUMN IF NOT EXISTS mycover_customer_id TEXT;

-- Backfill existing rows (all 5 are gadget/STI, verified via MyCover API)
UPDATE order_insurance_policies
SET
  policy_type = 'gadget',
  provider_name = 'Sovereign Trust Insurance Plc'
WHERE policy_type IS NULL;

-- Index on policy_type for future queries
CREATE INDEX IF NOT EXISTS idx_order_insurance_policies_policy_type
  ON order_insurance_policies (policy_type);
