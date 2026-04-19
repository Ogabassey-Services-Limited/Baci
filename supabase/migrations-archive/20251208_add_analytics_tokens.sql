-- Add Analytics Tokens and Snapchat Columns to merchant_feature_settings
-- Date: 2025-12-08
-- 
-- This migration adds missing columns for:
-- 1. Facebook Conversion API token
-- 2. TikTok Events API access token  
-- 3. Snapchat Pixel ID and CAPI token

-- Add new columns
ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS facebook_capi_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tiktok_access_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS snapchat_pixel_id VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS snapchat_capi_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ga4_api_secret TEXT DEFAULT NULL;

-- Add documentation comments
COMMENT ON COLUMN merchant_feature_settings.facebook_capi_token IS 'Facebook Conversion API access token for server-side event tracking';
COMMENT ON COLUMN merchant_feature_settings.tiktok_access_token IS 'TikTok Events API access token for server-side conversion tracking';
COMMENT ON COLUMN merchant_feature_settings.snapchat_pixel_id IS 'Snapchat Pixel ID for conversion tracking';
COMMENT ON COLUMN merchant_feature_settings.snapchat_capi_token IS 'Snapchat Conversion API token for server-side event tracking';
COMMENT ON COLUMN merchant_feature_settings.ga4_api_secret IS 'Google Analytics 4 Measurement Protocol API secret for server-side tracking';
