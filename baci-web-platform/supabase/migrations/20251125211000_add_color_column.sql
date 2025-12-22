-- Migration: Add Color Column to Products
-- Description: Adds a color column to the products table to support the new TagInput for colors.
-- Author: Antigravity
-- Date: 2025-11-25

ALTER TABLE products
ADD COLUMN color TEXT;

COMMENT ON COLUMN products.color IS 'Comma-separated list of colors available for this product';
