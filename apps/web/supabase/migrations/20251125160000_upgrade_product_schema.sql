-- Migration: Upgrade Product Schema
-- Description: Adds comprehensive e-commerce fields including SKU, slugs, multiple images, and GMC support
-- Author: Antigravity
-- Date: 2025-11-25

-- 1. Add new columns
ALTER TABLE products
    ADD COLUMN sku TEXT,
    ADD COLUMN slug TEXT,
    ADD COLUMN compare_at_price DECIMAL(10, 2),
    ADD COLUMN cost_price DECIMAL(10, 2),
    ADD COLUMN low_stock_threshold INTEGER DEFAULT 5,
    ADD COLUMN images JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN weight_value DECIMAL(10, 2),
    ADD COLUMN weight_unit TEXT DEFAULT 'kg',
    ADD COLUMN dimensions JSONB, -- { length, width, height, unit }
    ADD COLUMN status TEXT DEFAULT 'draft',
    ADD COLUMN taxable BOOLEAN DEFAULT true,
    ADD COLUMN tax_code TEXT,
    ADD COLUMN condition TEXT DEFAULT 'new',
    ADD COLUMN condition_detail TEXT,
    ADD COLUMN meta_title TEXT,
    ADD COLUMN meta_description TEXT,
    ADD COLUMN keywords TEXT[],
    ADD COLUMN canonical_url TEXT,
    ADD COLUMN schema_markup JSONB,
    ADD COLUMN gtin TEXT,
    ADD COLUMN mpn TEXT,
    ADD COLUMN google_product_category TEXT;

-- 2. Add constraints
ALTER TABLE products
    ADD CONSTRAINT check_status CHECK (status IN ('draft', 'active', 'archived')),
    ADD CONSTRAINT check_condition CHECK (condition IN ('new', 'used'));

-- 3. Create indexes
CREATE UNIQUE INDEX idx_products_merchant_sku ON products(merchant_id, sku);
CREATE UNIQUE INDEX idx_products_merchant_slug ON products(merchant_id, slug);
CREATE INDEX idx_products_status ON products(merchant_id, status);
CREATE INDEX idx_products_condition ON products(condition);
CREATE INDEX idx_products_keywords ON products USING GIN(keywords);

-- 4. Data Migration: is_active -> status
UPDATE products
SET status = CASE
    WHEN is_active = true THEN 'active'
    ELSE 'draft'
END;

-- 5. Data Migration: image_small/large -> images JSONB
-- We'll use image_large as the primary image if available, otherwise image_small
UPDATE products
SET images = (
    CASE
        WHEN image_large IS NOT NULL THEN
            jsonb_build_array(
                jsonb_build_object(
                    'url', image_large,
                    'alt', name,
                    'order', 0
                )
            )
        WHEN image_small IS NOT NULL THEN
            jsonb_build_array(
                jsonb_build_object(
                    'url', image_small,
                    'alt', name,
                    'order', 0
                )
            )
        ELSE '[]'::jsonb
    END
);

-- 6. Slug Generation Function & Trigger
CREATE OR REPLACE FUNCTION generate_product_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    new_slug TEXT;
    counter INTEGER := 1;
BEGIN
    -- Only generate slug if it's null or empty
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        -- Generate base slug from name (lowercase, replace non-alphanumeric with hyphen)
        base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        -- Remove leading/trailing hyphens
        base_slug := trim(both '-' from base_slug);
        
        new_slug := base_slug;
        
        -- Check for collision within the same merchant
        WHILE EXISTS (
            SELECT 1 FROM products 
            WHERE merchant_id = NEW.merchant_id 
            AND slug = new_slug 
            AND id != NEW.id -- Exclude self for updates
        ) LOOP
            counter := counter + 1;
            new_slug := base_slug || '-' || counter;
        END LOOP;
        
        NEW.slug := new_slug;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_product_slug
BEFORE INSERT OR UPDATE OF name, slug ON products
FOR EACH ROW
EXECUTE FUNCTION generate_product_slug();

-- 7. Backfill Slugs for existing products
-- This will trigger the slug generation for all existing rows
UPDATE products SET slug = NULL WHERE slug IS NULL;
