
-- Step 1: Add new columns to the products table
ALTER TABLE products
ADD COLUMN manage_stock BOOLEAN DEFAULT true,
ADD COLUMN fulfillment_fields JSONB;

-- Step 2: Rename the existing orders table
ALTER TABLE orders RENAME TO orders_old;

-- Step 3: Create the new orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    shipping_status TEXT DEFAULT 'pending' NOT NULL,
    payment_status TEXT DEFAULT 'unpaid' NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    shipping_address JSONB,
    source TEXT, -- 'whatsapp', 'instagram', 'online_store'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_order_number_per_merchant UNIQUE (merchant_id, order_number)
);

-- Step 4: Create the order_items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    fulfillment_data JSONB, -- Stores { "IMEI": "12345", "Serial": "abc" }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Migrate data from the old table to the new ones
DO $$
DECLARE
    order_record RECORD;
    item JSONB;
BEGIN
    FOR order_record IN SELECT * FROM orders_old
    LOOP
        -- Insert into the new orders table
        INSERT INTO orders (id, merchant_id, customer_id, order_number, customer_email, customer_name, total, shipping_address, created_at, updated_at, shipping_status)
        VALUES (
            order_record.id,
            order_record.merchant_id,
            order_record.customer_id,
            '#' || LPAD((ROW_NUMBER() OVER (PARTITION BY order_record.merchant_id ORDER BY order_record.created_at) + 1000)::TEXT, 5, '0'), -- Generate a simple order number
            order_record.customer_email,
            order_record.customer_name,
            order_record.subtotal,
            order_record.shipping_address,
            order_record.created_at,
            order_record.updated_at,
            order_record.status
        );

        -- Insert into the order_items table
        FOR item IN SELECT * FROM jsonb_array_elements(order_record.items)
        LOOP
            INSERT INTO order_items (order_id, product_id, name, price, quantity)
            VALUES (
                order_record.id,
                (item->>'product_id')::UUID,
                item->>'name',
                (item->>'price')::DECIMAL,
                (item->>'quantity')::INTEGER
            );
        END LOOP;
    END LOOP;
END $$;

-- Step 6: Update RLS policies for the new tables

-- Remove old orders policies
DROP POLICY IF EXISTS "Customers can view own orders" ON orders_old;
DROP POLICY IF EXISTS "Merchants can view own orders" ON orders_old;
DROP POLICY IF EXISTS "Merchants can update own orders" ON orders_old;
DROP POLICY IF EXISTS "Allow order creation" ON orders_old;

-- Enable RLS for the new tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- New Policies for 'orders'
CREATE POLICY "Merchants can manage their own orders"
  ON orders
  FOR ALL
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Customers can view their own orders"
  ON orders
  FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- New Policies for 'order_items'
CREATE POLICY "Users can view order items for orders they can access"
  ON order_items
  FOR SELECT
  USING (
    (
      -- Is the user the merchant of this order?
      order_id IN (SELECT id FROM orders WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()))
    ) OR (
      -- Is the user the customer of this order?
      order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Merchants can insert order items for their orders"
  ON order_items
  FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())));

CREATE POLICY "Merchants can update order items for their orders"
  ON order_items
  FOR UPDATE
  USING (order_id IN (SELECT id FROM orders WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())));

CREATE POLICY "Merchants can delete order items for their orders"
  ON order_items
  FOR DELETE
  USING (order_id IN (SELECT id FROM orders WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())));


-- Step 7: Drop the old table
DROP TABLE orders_old;

-- Step 8: Add triggers for the new tables
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
