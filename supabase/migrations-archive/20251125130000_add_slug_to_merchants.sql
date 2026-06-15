-- Migration: Add slug column to merchants table
-- Description: Adds unique slug for subdomain routing (merchant.usebaci.com)
-- Created: 2024-11-25

-- Add slug column
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create index for fast slug lookups (used by middleware)
CREATE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(slug);

-- Function to generate slug from business name
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convert to lowercase, replace spaces with hyphens, remove special chars
    base_slug := lower(regexp_replace(text_input, '[^a-zA-Z0-9\s-]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);

    -- Ensure slug is not empty
    IF base_slug = '' THEN
        base_slug := 'store';
    END IF;

    -- Check if slug exists and append number if needed
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM merchants WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;

    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Backfill slugs for existing merchants
UPDATE merchants
SET slug = generate_slug(business_name)
WHERE slug IS NULL;

-- Make slug NOT NULL after backfill
ALTER TABLE merchants
ALTER COLUMN slug SET NOT NULL;

-- Add comment
COMMENT ON COLUMN merchants.slug IS 'URL-safe slug for subdomain routing (e.g., "ogabassey" for ogabassey.usebaci.com)';
