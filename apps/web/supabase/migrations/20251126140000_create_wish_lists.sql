-- Migration: Create wish lists system
-- Created: 2025-11-26
-- Description: Add wish lists for customers to save products for later

-- Create wish_list_items table
CREATE TABLE IF NOT EXISTS wish_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email VARCHAR(255) NOT NULL,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate items
    CONSTRAINT unique_wish_list_item UNIQUE (customer_email, product_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wish_list_customer_email ON wish_list_items(customer_email);
CREATE INDEX IF NOT EXISTS idx_wish_list_merchant_id ON wish_list_items(merchant_id);
CREATE INDEX IF NOT EXISTS idx_wish_list_product_id ON wish_list_items(product_id);
CREATE INDEX IF NOT EXISTS idx_wish_list_customer_merchant ON wish_list_items(customer_email, merchant_id);

-- RLS Policies
ALTER TABLE wish_list_items ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read wish list items (for guest users)
CREATE POLICY "Anyone can read wish list items"
    ON wish_list_items
    FOR SELECT
    USING (true);

-- Allow anyone to insert wish list items (for guest users)
CREATE POLICY "Anyone can add to wish list"
    ON wish_list_items
    FOR INSERT
    WITH CHECK (true);

-- Allow anyone to delete their own wish list items
CREATE POLICY "Anyone can remove from their wish list"
    ON wish_list_items
    FOR DELETE
    USING (true);

-- Merchants can view all wish list items for their products
CREATE POLICY "Merchants can view wish lists for their products"
    ON wish_list_items
    FOR SELECT
    USING (
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

COMMENT ON TABLE wish_list_items IS 'Customer wish lists - saved products for later purchase';
COMMENT ON COLUMN wish_list_items.customer_email IS 'Customer email (supports guest users)';
