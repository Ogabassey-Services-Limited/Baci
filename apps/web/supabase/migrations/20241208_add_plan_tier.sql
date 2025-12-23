-- Migration: Add plan_tier to merchants table
-- Run this in Supabase SQL Editor

-- Step 1: Add plan_tier column with default 'free'
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'free';

-- Step 2: Add check constraint for valid values
ALTER TABLE merchants 
ADD CONSTRAINT valid_plan_tier 
CHECK (plan_tier IN ('free', 'starter', 'pro', 'business', 'enterprise'));

-- Step 3: Add features column for custom feature overrides (optional)
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS premium_features JSONB DEFAULT '[]'::jsonb;

-- Step 4: Add plan metadata columns
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Step 5: Create index for efficient plan queries
CREATE INDEX IF NOT EXISTS idx_merchants_plan_tier ON merchants(plan_tier);

-- Step 6: Set existing merchants to appropriate tiers (customize as needed)
-- Example: Set ogabassey to 'pro' for testing premium features
UPDATE merchants 
SET plan_tier = 'pro' 
WHERE slug = 'ogabassey';

-- Verify the migration
SELECT id, slug, plan_tier, premium_features 
FROM merchants 
LIMIT 10;
