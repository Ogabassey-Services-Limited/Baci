-- Add stock management columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS manage_stock BOOLEAN DEFAULT TRUE;

-- Update existing products to have manage_stock = true by default (safer start)
UPDATE products SET manage_stock = TRUE WHERE manage_stock IS NULL;
UPDATE products SET stock = 0 WHERE stock IS NULL;
