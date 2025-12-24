-- Update Orders Table Schema to Match Dashboard Requirements
-- Run this after running supabase-schema.sql

-- Add missing columns to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS shipping_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'online_store',
ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create a function to auto-generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  order_num TEXT;
BEGIN
  -- Get the count of existing orders + 1
  SELECT COUNT(*) + 1 INTO next_number FROM orders;

  -- Format as #06XXX (always 5 digits)
  order_num := '#' || LPAD(next_number::TEXT, 5, '0');

  -- Check if it already exists (in case of concurrent inserts)
  WHILE EXISTS (SELECT 1 FROM orders WHERE order_number = order_num) LOOP
    next_number := next_number + 1;
    order_num := '#' || LPAD(next_number::TEXT, 5, '0');
  END LOOP;

  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to auto-generate order numbers on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number();

-- Create index for order_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Add comments for documentation
COMMENT ON COLUMN orders.payment_status IS 'Payment status: paid, unpaid, pending, partially_paid, refunded';
COMMENT ON COLUMN orders.shipping_status IS 'Shipping status: pending, processing, shipped, delivered, canceled, returned';
COMMENT ON COLUMN orders.source IS 'Order source: online_store, whatsapp, instagram, in_person, other';
COMMENT ON COLUMN orders.order_number IS 'Auto-generated order number in format #06XXX';
