-- Create product_variants table for storing color/size/attribute combinations
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- Variant attributes (flexible JSONB for category-specific attributes)
  -- e.g., {"color": "Blue", "storage": "128GB"} for electronics
  -- or {"size": "M", "color": "Red"} for fashion
  attributes JSONB NOT NULL DEFAULT '{}',
  
  -- Pricing (can override base product price)
  price_override NUMERIC(10, 2),
  
  -- Images specific to this variant
  images JSONB DEFAULT '[]', -- Array of image URLs
  primary_image TEXT,
  
  -- Stock tracking per variant
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  
  -- SKU / identifier for this specific variant
  sku TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_merchant_id ON product_variants(merchant_id);
CREATE INDEX idx_product_variants_attributes ON product_variants USING GIN (attributes);

-- RLS Policies
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their variants"
  ON product_variants FOR SELECT
  USING (merchant_id = auth.uid() OR merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can insert their variants"
  ON product_variants FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update their variants"
  ON product_variants FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can delete their variants"
  ON product_variants FOR DELETE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
