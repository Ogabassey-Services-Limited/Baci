-- Migration: Add setup settings columns to page_configs table
-- Description: Adds draft_setup_settings and published_setup_settings columns to support
--              site-wide configuration (site settings, analytics, custom code injection)
-- Created: 2024-11-24

-- Add draft_setup_settings column (JSONB)
ALTER TABLE page_configs
ADD COLUMN IF NOT EXISTS draft_setup_settings JSONB DEFAULT NULL;

-- Add published_setup_settings column (JSONB)
ALTER TABLE page_configs
ADD COLUMN IF NOT EXISTS published_setup_settings JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN page_configs.draft_setup_settings IS
'Draft site setup settings including site info, branding, social media, analytics integration, and custom code injection';

COMMENT ON COLUMN page_configs.published_setup_settings IS
'Published site setup settings that are live on the storefront';

-- Create index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_page_configs_draft_setup_settings
ON page_configs USING gin (draft_setup_settings);

CREATE INDEX IF NOT EXISTS idx_page_configs_published_setup_settings
ON page_configs USING gin (published_setup_settings);

-- Sample setup settings structure (for documentation):
/*
{
  "site": {
    "title": "My Store",
    "tagline": "Premium products at affordable prices",
    "faviconUrl": "https://cdn.com/favicon.ico",
    "logoUrl": "https://cdn.com/logo.png",
    "contactEmail": "contact@store.com",
    "currency": "USD",
    "timezone": "America/New_York",
    "language": "en",
    "units": "imperial" | "metric"
  },
  "social": {
    "facebook": "https://facebook.com/store",
    "instagram": "https://instagram.com/store",
    "twitter": "https://twitter.com/store",
    "tiktok": "https://tiktok.com/@store",
    "youtube": "https://youtube.com/@store",
    "linkedin": "https://linkedin.com/company/store"
  },
  "analytics": {
    "googleAnalyticsId": "G-XXXXXXXXXX",
    "metaPixelId": "1234567890123456",
    "tiktokPixelId": "ABCDEFGHIJK1234567890",
    "customTrackingCode": "<!-- custom scripts -->"
  },
  "customCode": {
    "customCss": ".my-class { color: red; }",
    "customJs": "console.log('Hello');",
    "headScripts": "<script>/* head */</script>",
    "bodyScripts": "<script>/* body */</script>"
  }
}
*/
