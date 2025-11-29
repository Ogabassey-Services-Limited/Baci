-- Add GA4 Measurement Protocol API secret column to merchants table
-- This enables server-side tracking for Google Analytics 4

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS ga4_api_secret TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.merchants.ga4_api_secret IS 'GA4 Measurement Protocol API secret for server-side tracking. Get this from GA4 Admin > Data Streams > Measurement Protocol API secrets';
