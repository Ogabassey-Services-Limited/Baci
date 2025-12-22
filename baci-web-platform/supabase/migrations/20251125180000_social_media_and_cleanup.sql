-- Migration: Add social media fields and cleanup old product columns
-- Created: 2025-11-25
-- Description: Adds social_media JSONB to merchants, drops old product image columns, updates RLS
-- Note: Excludes condition constraint changes per user request

-- Step 1: Update RLS policy to use status instead of is_active
DROP POLICY IF EXISTS "Consolidated: Public can view active products or merchant can view own" ON products;

CREATE POLICY "Consolidated: Public can view active products or merchant can view own"
    ON products FOR SELECT
    USING (
        status = 'active' OR
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

-- Step 2: Drop old columns from products table
ALTER TABLE products DROP COLUMN IF EXISTS image_small;
ALTER TABLE products DROP COLUMN IF EXISTS image_large;
ALTER TABLE products DROP COLUMN IF EXISTS is_active;

COMMENT ON TABLE products IS 'Products table - old image columns (image_small, image_large) migrated to images JSONB, is_active replaced by status enum';

-- Step 3: Add social media fields to merchants table
ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS social_media JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN merchants.social_media IS 'Social media handles: { "twitter": "@handle", "facebook": "page", "instagram": "@handle", "tiktok": "@handle", "youtube": "channel", "pinterest": "username", "linkedin": "company" }';

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_merchants_social_media ON merchants USING GIN(social_media);
