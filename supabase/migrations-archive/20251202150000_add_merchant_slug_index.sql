-- Add unique index on merchants(slug) for faster storefront lookups
-- This is critical for performance as storefronts are accessed by slug

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(slug);

COMMENT ON INDEX idx_merchants_slug IS 'Index for fast merchant lookup by slug';
