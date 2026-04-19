-- Add missing payment gateway columns to merchant_feature_settings
ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS juicyway_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credpal_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN merchant_feature_settings.juicyway_enabled IS 'Enable Juicyway crypto payments (USDT, USDC)';
COMMENT ON COLUMN merchant_feature_settings.credpal_enabled IS 'Enable CredPal BNPL installment payments';
