-- Add payment gateway settings to merchant_feature_settings
-- Allows merchants to enable/disable payment gateways

-- Add payment gateway columns
ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS paystack_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS korapay_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS preferred_local_gateway VARCHAR(20) DEFAULT 'paystack',
ADD COLUMN IF NOT EXISTS preferred_international_gateway VARCHAR(20) DEFAULT 'korapay';

-- Add constraint for valid gateway values
ALTER TABLE merchant_feature_settings
ADD CONSTRAINT check_preferred_local_gateway
CHECK (preferred_local_gateway IN ('paystack', 'korapay'));

ALTER TABLE merchant_feature_settings
ADD CONSTRAINT check_preferred_international_gateway
CHECK (preferred_international_gateway IN ('paystack', 'korapay'));

-- Add comments
COMMENT ON COLUMN merchant_feature_settings.paystack_enabled IS 'Enable Paystack payment gateway (NGN local payments with split)';
COMMENT ON COLUMN merchant_feature_settings.korapay_enabled IS 'Enable Korapay payment gateway (multi-currency, international)';
COMMENT ON COLUMN merchant_feature_settings.preferred_local_gateway IS 'Preferred gateway for local NGN payments';
COMMENT ON COLUMN merchant_feature_settings.preferred_international_gateway IS 'Preferred gateway for international payments';
