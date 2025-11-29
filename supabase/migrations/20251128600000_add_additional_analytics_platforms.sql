-- Add additional analytics platform columns to merchants table
-- Supports TikTok, Snapchat, and Twitter/X tracking with server-side APIs

-- TikTok Pixel and Events API
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS tiktok_pixel_id TEXT,
ADD COLUMN IF NOT EXISTS tiktok_access_token TEXT;

-- Snapchat Pixel and Conversions API
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS snapchat_pixel_id TEXT,
ADD COLUMN IF NOT EXISTS snapchat_capi_token TEXT;

-- Twitter/X Pixel (CAPI requires OAuth 1.0a which is complex, pixel-only for now)
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS twitter_pixel_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN merchants.tiktok_pixel_id IS 'TikTok Pixel ID. Get from TikTok Ads Manager → Events → Web Events → Pixel Code';
COMMENT ON COLUMN merchants.tiktok_access_token IS 'TikTok Events API access token for server-side tracking. Get from TikTok Ads Manager → Events → Settings → Generate Access Token';

COMMENT ON COLUMN merchants.snapchat_pixel_id IS 'Snapchat Pixel ID. Get from Snapchat Ads Manager → Events Manager → View Pixel Code';
COMMENT ON COLUMN merchants.snapchat_capi_token IS 'Snapchat Conversions API token for server-side tracking. Get from Snapchat Ads Manager → Events Manager → Generate Token';

COMMENT ON COLUMN merchants.twitter_pixel_id IS 'Twitter/X Pixel ID. Get from Twitter Ads → Tools → Events Manager → Add Event Source';
