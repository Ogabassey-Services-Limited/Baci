-- Migration: Update Product Variants
-- Description: Adds cost_price to product_variants for profit tracking
-- Author: Antigravity
-- Date: 2025-11-25

ALTER TABLE product_variants
    ADD COLUMN cost_price DECIMAL(10, 2);
