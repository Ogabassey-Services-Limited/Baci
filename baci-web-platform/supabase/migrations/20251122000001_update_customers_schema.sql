-- Add new columns to existing customers table
ALTER TABLE customers 
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS store_credit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent numeric DEFAULT 0;

-- Migrate existing data: combine first_name and last_name into full_name
UPDATE customers 
SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE full_name IS NULL;

-- Set default values for new columns
UPDATE customers 
SET store_credit = 0 
WHERE store_credit IS NULL;

UPDATE customers 
SET total_orders = 0 
WHERE total_orders IS NULL;

UPDATE customers 
SET total_spent = 0 
WHERE total_spent IS NULL;

-- Make full_name NOT NULL after migration
ALTER TABLE customers 
  ALTER COLUMN full_name SET NOT NULL;

-- Drop old columns if they exist (optional - comment out if you want to keep them)
-- ALTER TABLE customers 
--   DROP COLUMN IF EXISTS first_name,
--   DROP COLUMN IF EXISTS last_name;
