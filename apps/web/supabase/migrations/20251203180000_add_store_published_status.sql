-- Add store published status to merchants table
-- This controls whether a store is publicly accessible

-- Add is_published column (default false - stores start unpublished)
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- Add published_at timestamp to track when store was first published
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN merchants.is_published IS 'Whether the store is publicly accessible. Merchants must complete required setup before publishing.';
COMMENT ON COLUMN merchants.published_at IS 'Timestamp when the store was first published';

-- Create index for filtering published stores
CREATE INDEX IF NOT EXISTS idx_merchants_is_published ON merchants(is_published) WHERE is_published = true;

-- Update existing merchants:
-- If they have bank details AND at least one product, consider them published (grandfathered in)
-- This prevents breaking existing live stores
UPDATE merchants m
SET
  is_published = true,
  published_at = COALESCE(m.created_at, NOW())
WHERE
  m.is_published IS NOT TRUE
  AND m.paystack_subaccount_code IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM products p
    WHERE p.merchant_id = m.id
    AND p.status = 'published'
  );
