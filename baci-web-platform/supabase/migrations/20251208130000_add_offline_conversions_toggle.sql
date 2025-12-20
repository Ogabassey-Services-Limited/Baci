-- Migration: Add toggle for offline conversions feature
-- This allows merchants to explicitly disable CAPI/offline conversion tracking

-- Add column to control offline conversions (defaults to true - enabled)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS offline_conversions_enabled boolean DEFAULT true;

-- Add comment
COMMENT ON COLUMN merchants.offline_conversions_enabled IS 'When true, sends purchase events to configured ad platforms (Facebook CAPI, TikTok, GA4, Snapchat) after successful payments. Disable for privacy-focused stores.';
