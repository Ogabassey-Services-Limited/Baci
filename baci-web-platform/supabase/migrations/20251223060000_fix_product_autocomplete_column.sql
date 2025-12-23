-- Migration: Fix product_autocomplete column reference
-- Created: 2025-12-23
-- Description: The product_autocomplete function references p.image column which doesn't exist.
--              Changed to only use p.images[1] (the first element of the images array).

CREATE OR REPLACE FUNCTION product_autocomplete(
    merchant_id_param UUID, 
    search_prefix TEXT, 
    result_limit INT DEFAULT 10
)
 RETURNS TABLE(id uuid, name text, category text, price numeric, image_small text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.category,
        p.price,
        -- Use first element of images array (text[]), handle empty arrays gracefully
        COALESCE(
            NULLIF(p.images[1], ''),
            ''
        ) as image_small
    FROM public.products p
    WHERE p.merchant_id = merchant_id_param
      AND p.status = 'active'
      AND (
          p.name ILIKE search_prefix || '%'
          OR p.category ILIKE search_prefix || '%'
      )
    ORDER BY
        CASE WHEN p.name ILIKE search_prefix || '%' THEN 0 ELSE 1 END,
        p.name
    LIMIT result_limit;
END;
$function$;
