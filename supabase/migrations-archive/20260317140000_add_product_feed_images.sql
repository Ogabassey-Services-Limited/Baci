-- product_feed_images: prevalidated image manifest for Google Merchant Center feed.
-- The feed route reads only verified rows from this table — zero runtime image validation.

CREATE TABLE IF NOT EXISTS product_feed_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid NULL,
  source_url text NOT NULL,
  verified_url text NULL,
  verified_format text NULL CHECK (verified_format IN ('jpeg', 'png', 'webp')),
  status text NOT NULL DEFAULT 'missing' CHECK (status IN ('verified', 'missing', 'invalid', 'stale')),
  is_primary boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  verified_at timestamptz NULL,
  last_checked_at timestamptz NULL,
  failure_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for feed query performance
CREATE INDEX IF NOT EXISTS idx_product_feed_images_merchant_status
  ON product_feed_images(merchant_id, status);

CREATE INDEX IF NOT EXISTS idx_product_feed_images_product
  ON product_feed_images(product_id);

-- Unique constraint: one primary image per product (per variant if applicable)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_feed_images_primary
  ON product_feed_images(merchant_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_primary = true;

-- Unique constraint for upsert: one row per source URL per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_feed_images_source
  ON product_feed_images(merchant_id, product_id, source_url);

-- Constraint: verified_url must be absolute when status is 'verified'
ALTER TABLE product_feed_images
  ADD CONSTRAINT chk_verified_url_absolute
  CHECK (
    status != 'verified'
    OR (verified_url IS NOT NULL AND verified_url LIKE 'http%')
  );

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_product_feed_images_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_feed_images_updated_at
  BEFORE UPDATE ON product_feed_images
  FOR EACH ROW EXECUTE FUNCTION update_product_feed_images_updated_at();

-- RLS
ALTER TABLE product_feed_images ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their own feed images
CREATE POLICY "merchants_own_feed_images" ON product_feed_images
  FOR ALL USING (auth.uid() = merchant_id);

-- Public read for verified rows (feed route uses anon key)
CREATE POLICY "public_read_verified_feed_images" ON product_feed_images
  FOR SELECT USING (status = 'verified');
