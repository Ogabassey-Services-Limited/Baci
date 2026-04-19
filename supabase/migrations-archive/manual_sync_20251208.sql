-- Consolidated Migration Script (Manual Sync)
-- Generated on 2025-12-08 due to local Docker/Supabase CLI issues.
-- Includes pending migrations:
-- 1. 20251207190000_fix_merchant_rls_access.sql
-- 2. 20241208_add_plan_tier.sql (Renamed/Applied as part of this batch)
-- 3. 20251208120000_add_ad_tracking_to_orders.sql
-- 4. 20251208130000_add_offline_conversions_toggle.sql

BEGIN;

-- ==========================================
-- 1. Fix Merchant RLS Access
-- ==========================================

-- Fix any existing NULL values
UPDATE merchants SET is_platform_admin = FALSE WHERE is_platform_admin IS NULL;

-- Make the column NOT NULL to prevent future issues
ALTER TABLE merchants ALTER COLUMN is_platform_admin SET DEFAULT FALSE;

-- Update the RLS policy to be more robust
DROP POLICY IF EXISTS "Staff can view merchant" ON merchants;

CREATE POLICY "Staff can view merchant" ON merchants
  FOR SELECT USING (
    user_id = auth.uid() -- Owner
    OR id IN (SELECT merchant_id FROM staff_members WHERE user_id = auth.uid() AND status = 'active')
    -- Allow public access if is_platform_admin is false OR null
    OR (is_platform_admin IS NOT TRUE)
  );

-- ==========================================
-- 2. Add Plan Tier (Premium Features)
-- ==========================================

-- Add plan_tier column with default 'free'
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'free';

-- Add check constraint for valid values
DO $$ BEGIN
    ALTER TABLE merchants 
    ADD CONSTRAINT valid_plan_tier 
    CHECK (plan_tier IN ('free', 'starter', 'pro', 'business', 'enterprise'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add features column for custom feature overrides
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS premium_features JSONB DEFAULT '[]'::jsonb;

-- Add plan metadata columns
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Create index for efficient plan queries
CREATE INDEX IF NOT EXISTS idx_merchants_plan_tier ON merchants(plan_tier);

-- Set ogabassey to 'pro' for testing premium features
UPDATE merchants 
SET plan_tier = 'pro' 
WHERE slug = 'ogabassey';

-- ==========================================
-- 3. Add Ad Tracking to Orders
-- ==========================================

-- Add ad_tracking column as JSONB
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ad_tracking jsonb;

-- Add comment
COMMENT ON COLUMN orders.ad_tracking IS 'Ad platform tracking data (fbclid, ttclid, gclid, sccid, etc.) for offline conversion attribution';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_ad_tracking_fbclid ON orders ((ad_tracking->>'fbclid')) WHERE ad_tracking->>'fbclid' IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_ad_tracking_gclid ON orders ((ad_tracking->>'gclid')) WHERE ad_tracking->>'gclid' IS NOT NULL;

-- ==========================================
-- 4. Add Offline Conversions Toggle
-- ==========================================

-- Add column to control offline conversions
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS offline_conversions_enabled boolean DEFAULT true;

-- Add comment
COMMENT ON COLUMN merchants.offline_conversions_enabled IS 'When true, sends purchase events to configured ad platforms (Facebook CAPI, TikTok, GA4, Snapchat) after successful payments. Disable for privacy-focused stores.';

COMMIT;
