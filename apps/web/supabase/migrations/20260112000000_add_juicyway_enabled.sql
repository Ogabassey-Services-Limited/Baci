-- Add JuicyWay enabled column to merchant_feature_settings
ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS juicyway_enabled BOOLEAN DEFAULT true;

-- Add comments
COMMENT ON COLUMN merchant_feature_settings.juicyway_enabled IS 'Enable JuicyWay payment gateway (Crypto/Web3 payments)';
