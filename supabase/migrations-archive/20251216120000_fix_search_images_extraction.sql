-- Migration: Fix image extraction in search functions
-- Created: 2025-12-16
-- Description: Updates search functions to handle 'images' column being a string array (text[]) instead of an object array.
-- Also provides fallback to legacy 'image' column.

-- ============================================================================
-- PART 1: Fix product_autocomplete code
-- ============================================================================

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
        -- Robust image extraction: Try images array index 0, then legacy image column
        COALESCE(
            NULLIF(p.images->>0, ''),
            NULLIF(p.image, '')
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


-- ============================================================================
-- PART 2: Fix smart_product_search code
-- ============================================================================

CREATE OR REPLACE FUNCTION smart_product_search(
    search_query TEXT,
    merchant_id_param UUID,
    result_limit INT DEFAULT 20
) RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    price DECIMAL,
    image_small TEXT,
    image_large TEXT,
    category TEXT,
    relevance REAL
) AS $$
DECLARE
    query_length INT;
BEGIN
    query_length := LENGTH(TRIM(search_query));

    -- Strategy 1: Very short query (< 4 chars) - Use trigram for typo tolerance
    IF query_length < 4 THEN
        RETURN QUERY
        SELECT
            p.id,
            p.name,
            p.description,
            p.price,
            COALESCE(NULLIF(p.images->>0, ''), NULLIF(p.image, ''))::TEXT as image_small,
            COALESCE(NULLIF(p.images->>0, ''), NULLIF(p.image, ''))::TEXT as image_large,
            p.category,
            similarity(p.name, search_query)::REAL as relevance
        FROM products p
        WHERE p.merchant_id = merchant_id_param
          AND p.status = 'active'
          AND p.name % search_query  -- Trigram similarity operator
        ORDER BY relevance DESC
        LIMIT result_limit;

    -- Strategy 2: Normal query (4+ chars) - Use full-text search (faster)
    ELSE
        RETURN QUERY
        SELECT
            p.id,
            p.name,
            p.description,
            p.price,
            COALESCE(NULLIF(p.images->>0, ''), NULLIF(p.image, ''))::TEXT as image_small,
            COALESCE(NULLIF(p.images->>0, ''), NULLIF(p.image, ''))::TEXT as image_large,
            p.category,
            ts_rank(
                to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')),
                plainto_tsquery('english', search_query)
            )::REAL as relevance
        FROM products p
        WHERE p.merchant_id = merchant_id_param
          AND p.status = 'active'
          AND to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, ''))
              @@ plainto_tsquery('english', search_query)
        ORDER BY relevance DESC
        LIMIT result_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;
