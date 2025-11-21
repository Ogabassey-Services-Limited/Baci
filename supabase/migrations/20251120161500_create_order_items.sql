-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policies

-- Customers can view their own order items
CREATE POLICY "Customers can view own order items"
  ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN customers ON orders.customer_id = customers.id
      WHERE orders.id = order_items.order_id
      AND customers.user_id = auth.uid()
    )
  );

-- Merchants can view their own order items
CREATE POLICY "Merchants can view own order items"
  ON order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN merchants ON orders.merchant_id = merchants.id
      WHERE orders.id = order_items.order_id
      AND merchants.user_id = auth.uid()
    )
  );

-- Allow insert if related order exists (simplified for MVP)
CREATE POLICY "Allow insert for valid orders"
  ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE id = order_items.order_id)
  );
