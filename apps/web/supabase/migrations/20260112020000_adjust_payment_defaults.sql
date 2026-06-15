-- Adjust default values for payment gateways
-- We want ONLY Paystack to be enabled by default.

-- 1. Change schema defaults
ALTER TABLE merchant_feature_settings
ALTER COLUMN korapay_enabled SET DEFAULT false,
ALTER COLUMN juicyway_enabled SET DEFAULT false,
ALTER COLUMN paystack_enabled SET DEFAULT true;

-- 2. Update existing rows that are likely in the "all enabled" default state
-- This specifically targets the rows we just backfilled (or any that were left at default true)
-- We check for rows where ALL are true, and set non-Paystack to false.
UPDATE merchant_feature_settings
SET
    korapay_enabled = false,
    juicyway_enabled = false
WHERE
    paystack_enabled = true
    AND korapay_enabled = true
    AND juicyway_enabled = true;

-- Add comment explaining the new default policy
COMMENT ON TABLE merchant_feature_settings IS 'Feature settings. Default: Paystack enabled, others disabled.';
