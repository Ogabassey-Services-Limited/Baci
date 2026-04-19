-- Add Credit Direct BNPL support to merchant_feature_settings
-- This enables merchants to offer Buy Now Pay Later via Credit Direct

-- Add Credit Direct columns to merchant_feature_settings
ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS credit_direct_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_direct_public_key TEXT,
ADD COLUMN IF NOT EXISTS credit_direct_min_amount DECIMAL(10,2) DEFAULT 10000.00,
ADD COLUMN IF NOT EXISTS credit_direct_max_amount DECIMAL(10,2) DEFAULT 500000.00;

-- Add comment for documentation
COMMENT ON COLUMN merchant_feature_settings.credit_direct_enabled IS 'Whether Credit Direct BNPL is enabled for this merchant';
COMMENT ON COLUMN merchant_feature_settings.credit_direct_public_key IS 'Merchant public key from Credit Direct dashboard';
COMMENT ON COLUMN merchant_feature_settings.credit_direct_min_amount IS 'Minimum order amount for BNPL eligibility (default 10,000 NGN)';
COMMENT ON COLUMN merchant_feature_settings.credit_direct_max_amount IS 'Maximum order amount for BNPL eligibility (default 500,000 NGN)';

-- Update orders table comment to include BNPL statuses
COMMENT ON COLUMN orders.payment_status IS 'Payment status: unpaid, paid, bnpl_pending, bnpl_approved, refunded, failed';

-- Add index for Credit Direct-enabled merchants (for filtering)
CREATE INDEX IF NOT EXISTS idx_merchant_feature_settings_credit_direct_enabled
ON merchant_feature_settings(merchant_id)
WHERE credit_direct_enabled = true;
