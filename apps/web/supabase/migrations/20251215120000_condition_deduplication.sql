-- Phase 7: Condition-Based Deduplication Schema Enhancement
-- Migration: Add condition support to product variants and create offers table
-- Author: Antigravity
-- Date: 2025-12-15

-- ============================================
-- 1. ADD CONDITION COLUMN TO PRODUCT_VARIANTS
-- ============================================

ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS condition TEXT 
CHECK (condition IN ('new', 'used', 'open_box', 'refurbished'));

COMMENT ON COLUMN product_variants.condition IS 'Product condition: new, used, open_box, refurbished';

-- Create index for condition filtering
CREATE INDEX IF NOT EXISTS idx_product_variants_condition ON product_variants(condition);

-- ============================================
-- 2. CREATE PRODUCT_OFFERS TABLE (ALTERNATIVE)
-- This table provides a cleaner approach for 
-- products that vary primarily by condition
-- ============================================

CREATE TABLE IF NOT EXISTS product_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- Condition (required)
  condition TEXT NOT NULL CHECK (condition IN ('new', 'used', 'open_box', 'refurbished')),
  
  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2), -- Original price for "was X, now Y"
  
  -- Stock
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  
  -- Condition-specific images (optional)
  images JSONB DEFAULT '[]',
  
  -- Notes about this specific condition
  condition_notes TEXT, -- e.g., "Minor scratches on back"
  
  -- Grade for used items (optional)
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D')), -- A = Like new, D = Heavy wear
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold_out')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one offer per condition per product
  UNIQUE(product_id, condition)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_offers_product_id ON product_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_merchant_id ON product_offers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_condition ON product_offers(condition);
CREATE INDEX IF NOT EXISTS idx_product_offers_status ON product_offers(status) WHERE status = 'active';

-- RLS
ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view active offers"
    ON product_offers FOR SELECT
    USING (status = 'active');

CREATE POLICY "Merchants can manage their offers"
    ON product_offers FOR ALL
    TO authenticated
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    ))
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    ));

-- ============================================
-- 3. UPDATE PRODUCTS TABLE FOR PARENT SUPPORT
-- ============================================

-- Add flag to indicate if product has condition variants
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS has_condition_offers BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN products.has_condition_offers IS 'True if this product has entries in product_offers table';

-- ============================================
-- 4. HELPER FUNCTION: Get all offers for a product
-- ============================================

CREATE OR REPLACE FUNCTION get_product_offers(p_product_id UUID)
RETURNS TABLE (
  offer_id UUID,
  condition TEXT,
  price DECIMAL(10,2),
  compare_at_price DECIMAL(10,2),
  stock_quantity INTEGER,
  grade TEXT,
  condition_notes TEXT,
  images JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.condition,
    po.price,
    po.compare_at_price,
    po.stock_quantity,
    po.grade,
    po.condition_notes,
    po.images
  FROM product_offers po
  WHERE po.product_id = p_product_id
  AND po.status = 'active'
  ORDER BY 
    CASE po.condition 
      WHEN 'new' THEN 1 
      WHEN 'open_box' THEN 2
      WHEN 'refurbished' THEN 3
      WHEN 'used' THEN 4
    END;
END;
$$;

-- ============================================
-- 5. UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_product_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_offers_updated_at ON product_offers;
CREATE TRIGGER update_product_offers_updated_at
  BEFORE UPDATE ON product_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_product_offers_updated_at();

-- ============================================
-- 6. GRANTS
-- ============================================

GRANT SELECT ON product_offers TO authenticated;
GRANT ALL ON product_offers TO service_role;

-- Comments
COMMENT ON TABLE product_offers IS 'Condition-based offers for products (New, Used, Open Box, Refurbished)';
COMMENT ON FUNCTION get_product_offers IS 'Returns all active condition offers for a product';
