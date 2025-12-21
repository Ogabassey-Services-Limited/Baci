-- Create variant_inventory table for tracking individual units with unique identifiers
-- This enables tracking specific S/N, IMEI, batch numbers, etc. for each stock unit
CREATE TABLE IF NOT EXISTS variant_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- Fulfillment identifier (key-value pair)
  identifier_type TEXT NOT NULL, -- 'S/N', 'IMEI', 'SKU', 'BATCH', etc.
  identifier_value TEXT NOT NULL,
  
  -- Status tracking for inventory lifecycle
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'reserved', 'defective', 'returned')),
  
  -- Optional: order tracking when sold
  order_id UUID, -- Future: REFERENCES orders(id)
  sold_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_variant_inventory_variant_id ON variant_inventory(variant_id);
CREATE INDEX idx_variant_inventory_merchant_id ON variant_inventory(merchant_id);
CREATE INDEX idx_variant_inventory_status ON variant_inventory(status);

-- Ensure unique identifiers per merchant (can't have duplicate S/N across merchant's inventory)
CREATE UNIQUE INDEX idx_variant_inventory_unique_identifier 
  ON variant_inventory(merchant_id, identifier_type, identifier_value);

-- RLS Policies
ALTER TABLE variant_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their inventory"
  ON variant_inventory FOR SELECT
  USING (merchant_id = auth.uid() OR merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can insert their inventory"
  ON variant_inventory FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update their inventory"
  ON variant_inventory FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Merchants can delete their inventory"
  ON variant_inventory FOR DELETE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
