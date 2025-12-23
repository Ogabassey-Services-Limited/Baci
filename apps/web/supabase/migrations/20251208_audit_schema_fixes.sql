-- Audit Fixes: Schema Updates for Builder and Twitter
-- Date: 2025-12-08

-- 1. Add published_config to merchants (Critical for Builder/Announcement Bar)
-- This was missing, causing store layout and announcement bar saves to fail silently
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS published_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN merchants.published_config IS 'Stores the published page builder configuration and layout settings';

-- 2. Add twitter_pixel_id to feature settings (Consistency)
-- Moving from merchants table to feature settings to match other pixels
ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS twitter_pixel_id VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN merchant_feature_settings.twitter_pixel_id IS 'X (Twitter) Pixel ID for conversion tracking';
