-- Fix More Advisor Errors
-- 1. Fix function_search_path_mutable on public.product_autocomplete
-- 2. Fix function_search_path_mutable on public.generate_product_slug

-- 1. Fix product_autocomplete
CREATE OR REPLACE FUNCTION product_autocomplete(
    search_prefix TEXT,
    merchant_id_param UUID,
    result_limit INT DEFAULT 10
) RETURNS TABLE (
    id UUID,
    name TEXT,
    category TEXT,
    price DECIMAL,
    image_small TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.category,
        p.price,
        p.image_small
    FROM products p
    WHERE p.merchant_id = merchant_id_param
      AND p.is_active = true
      AND (
          p.name ILIKE search_prefix || '%'
          OR p.category ILIKE search_prefix || '%'
      )
    ORDER BY
        -- Prioritize name matches
        CASE WHEN p.name ILIKE search_prefix || '%' THEN 0 ELSE 1 END,
        p.name
    LIMIT result_limit;
END;
$$;

-- 2. Fix generate_product_slug
CREATE OR REPLACE FUNCTION generate_product_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;
