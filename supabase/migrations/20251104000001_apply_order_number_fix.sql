-- This file fixes the race condition in the order number generation.

-- Create a table to store the last order number for each merchant
CREATE TABLE merchant_order_counters (
  merchant_id UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  last_order_number INTEGER NOT NULL DEFAULT 0
);

-- Backfill the counter table from existing orders.
-- This query assumes order numbers are in the format '#XXXXX'
INSERT INTO merchant_order_counters (merchant_id, last_order_number)
SELECT
  merchant_id,
  COALESCE(MAX(CAST(SUBSTRING(order_number FROM 2) AS INTEGER)), 0)
FROM orders
WHERE order_number ~ '^#\d+$' -- Ensure we only consider valid formats
GROUP BY merchant_id
ON CONFLICT (merchant_id) DO NOTHING;


-- Create a function to generate order numbers atomically and per merchant
CREATE OR REPLACE FUNCTION generate_order_number_for_merchant(merchant_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    order_num TEXT;
BEGIN
    -- Initialize counter for new merchants or increment existing one atomically
    INSERT INTO merchant_order_counters (merchant_id, last_order_number)
    VALUES (merchant_uuid, 1)
    ON CONFLICT (merchant_id)
    DO UPDATE SET last_order_number = merchant_order_counters.last_order_number + 1
    RETURNING last_order_number INTO next_num;

    -- Format the order number (e.g., #00001)
    order_num := '#' || LPAD(next_num::TEXT, 5, '0');
    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger function to use the new, safer order number generation function
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number_for_merchant(NEW.merchant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the old, race-condition-prone function
DROP FUNCTION IF EXISTS generate_order_number();

-- Comments for clarity
COMMENT ON TABLE merchant_order_counters IS 'Stores the last used order number for each merchant to prevent race conditions.';
COMMENT ON FUNCTION generate_order_number_for_merchant IS 'Generates a new, unique, and sequential order number for a given merchant atomically.';
