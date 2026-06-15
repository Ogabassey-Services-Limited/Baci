-- Add public read policy for categories table
-- The storefront needs to fetch categories for the "Shop by Category" navigation
-- without requiring authentication

-- First, ensure RLS is enabled (no-op if already enabled)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Drop existing public read policy if it exists (to make migration idempotent)
DROP POLICY IF EXISTS "Public can read categories" ON categories;

-- Create policy for public read access to categories
-- Categories are public data used for navigation on storefronts
CREATE POLICY "Public can read categories"
ON categories
FOR SELECT
TO public
USING (true);

-- Also ensure merchants can manage their own categories
DROP POLICY IF EXISTS "Merchants can manage their categories" ON categories;
CREATE POLICY "Merchants can manage their categories"
ON categories
FOR ALL
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

COMMENT ON POLICY "Public can read categories" ON categories IS
'Allows unauthenticated access to read categories for storefront navigation';
