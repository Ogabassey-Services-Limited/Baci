-- Deprecate the products.category TEXT column
-- The category_id FK now links products to the categories table
-- All code has been refactored to use: product.categories?.name || product.category

-- Add comment marking the column as deprecated
COMMENT ON COLUMN products.category IS 'DEPRECATED: Use category_id FK instead. Will be removed in future migration.';

-- Note: We're NOT dropping the column yet to allow for:
-- 1. Verification that the refactored code works in production
-- 2. Rollback capability if issues are found
-- 3. Data reconciliation checks

-- To drop the column in a future migration, run:
-- ALTER TABLE products DROP COLUMN IF EXISTS category;
