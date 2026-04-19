-- Migration: Add ad_tracking column to orders table
-- This stores click IDs and browser IDs from ad platforms for better offline conversion attribution
-- Stored data: fbclid, fbp, ttclid, ttp, gclid, sccid, gaClientId

-- Add ad_tracking column as JSONB for flexible storage of tracking data
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ad_tracking jsonb;

-- Add comment describing the column
COMMENT ON COLUMN orders.ad_tracking IS 'Ad platform tracking data (fbclid, ttclid, gclid, sccid, etc.) for offline conversion attribution';

-- Create index for queries that filter by ad platform
-- This enables efficient queries like "show all orders from Facebook ads"
CREATE INDEX IF NOT EXISTS idx_orders_ad_tracking_fbclid ON orders ((ad_tracking->>'fbclid')) WHERE ad_tracking->>'fbclid' IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_ad_tracking_gclid ON orders ((ad_tracking->>'gclid')) WHERE ad_tracking->>'gclid' IS NOT NULL;
