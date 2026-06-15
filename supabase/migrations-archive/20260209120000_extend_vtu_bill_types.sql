-- Extend VTU support to all Kuda bill types: electricity, cable TV, betting
-- Previously only 'airtime' and 'data' were supported

-- 1. Expand the type CHECK constraint to include new bill types
ALTER TABLE vtu_transactions DROP CONSTRAINT IF EXISTS vtu_transactions_type_check;
ALTER TABLE vtu_transactions ADD CONSTRAINT vtu_transactions_type_check
  CHECK (type IN ('airtime', 'data', 'electricity', 'cable_tv', 'betting'));

-- 2. Add columns for non-telco bill purchases
ALTER TABLE vtu_transactions
  ADD COLUMN IF NOT EXISTS biller_name TEXT,
  ADD COLUMN IF NOT EXISTS biller_item_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_identifier TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_cashback DECIMAL(10,2) DEFAULT 0;

-- 3. Expand source CHECK to include storefront_modal (web parity)
ALTER TABLE vtu_transactions DROP CONSTRAINT IF EXISTS vtu_transactions_source_check;
ALTER TABLE vtu_transactions ADD CONSTRAINT vtu_transactions_source_check
  CHECK (source IN ('checkout', 'loyalty_reward', 'direct', 'gift', 'storefront_modal'));

-- 4. Add VTU feature toggles for new bill types
ALTER TABLE merchant_feature_settings
  ADD COLUMN IF NOT EXISTS vtu_electricity_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vtu_tv_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vtu_betting_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vtu_customer_cashback_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vtu_customer_cashback_rate DECIMAL(5,2) DEFAULT 50.00;

-- 5. Index for biller-based queries
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_type ON vtu_transactions(type);
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_biller ON vtu_transactions(biller_name) WHERE biller_name IS NOT NULL;

COMMENT ON COLUMN vtu_transactions.biller_name IS 'Biller name (e.g., DSTV, AEDC) for non-telco bills';
COMMENT ON COLUMN vtu_transactions.biller_item_code IS 'Kuda BillItemIdentifier used for the purchase';
COMMENT ON COLUMN vtu_transactions.customer_identifier IS 'Meter number, smart card number, or betting account ID';
COMMENT ON COLUMN vtu_transactions.customer_name IS 'Verified customer name from Kuda';
COMMENT ON COLUMN vtu_transactions.customer_cashback IS 'Cashback amount credited to customer wallet';
