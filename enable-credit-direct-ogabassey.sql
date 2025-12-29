-- Enable Credit Direct BNPL for ogabassey merchant
-- Run this in your Supabase SQL editor

-- First, get the merchant ID for ogabassey
-- Then update or insert the feature settings

-- Option 1: If merchant_feature_settings row exists, UPDATE it
UPDATE merchant_feature_settings
SET 
  credit_direct_enabled = true,
  credit_direct_min_amount = 10000,  -- ₦10,000 minimum
  credit_direct_max_amount = 5000000,  -- ₦5,000,000 maximum
  credit_direct_public_key = 'YOUR_CREDIT_DIRECT_PUBLIC_KEY_HERE',  -- Add your actual key
  updated_at = NOW()
WHERE merchant_id = (SELECT id FROM merchants WHERE slug = 'ogabassey');

-- Option 2: If merchant_feature_settings row doesn't exist, INSERT it
INSERT INTO merchant_feature_settings (
  merchant_id,
  credit_direct_enabled,
  credit_direct_min_amount,
  credit_direct_max_amount,
  credit_direct_public_key,
  created_at,
  updated_at
)
SELECT 
  id,
  true,
  10000,
  5000000,
  'YOUR_CREDIT_DIRECT_PUBLIC_KEY_HERE',  -- Add your actual key
  NOW(),
  NOW()
FROM merchants
WHERE slug = 'ogabassey'
ON CONFLICT (merchant_id) DO UPDATE SET
  credit_direct_enabled = true,
  credit_direct_min_amount = 10000,
  credit_direct_max_amount = 5000000,
  credit_direct_public_key = EXCLUDED.credit_direct_public_key,
  updated_at = NOW();

-- Verify the update
SELECT 
  m.slug,
  mfs.credit_direct_enabled,
  mfs.credit_direct_public_key,
  mfs.credit_direct_min_amount,
  mfs.credit_direct_max_amount
FROM merchants m
JOIN merchant_feature_settings mfs ON m.id = mfs.merchant_id
WHERE m.slug = 'ogabassey';
