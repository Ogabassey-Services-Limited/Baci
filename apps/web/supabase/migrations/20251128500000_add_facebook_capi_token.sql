-- Add Facebook Conversions API token to merchants table
-- This enables server-side tracking for better attribution

ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS facebook_capi_token TEXT;

-- Add comment for documentation
COMMENT ON COLUMN merchants.facebook_capi_token IS 'Facebook Conversions API access token for server-side event tracking. Get from Events Manager → Settings → Generate Access Token';
