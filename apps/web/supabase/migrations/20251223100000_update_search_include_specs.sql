-- Migration: Include specs in product search
-- Created: 2025-12-23
-- Description: Updates smart_product_search to include 'specs' and 'specifications' (JSON) in the text search vector.

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
                to_tsvector('english',
                    COALESCE(p.name, '') || ' ' ||
                    COALESCE(p.description, '') || ' ' ||
                    -- Include specs string if it exists
                    COALESCE(p.specs, '') || ' ' ||
                    -- Include JSON specifications as text if they exist
                    COALESCE(p.specifications::text, '')
                ),
                plainto_tsquery('english', search_query)
            )::REAL as relevance
        FROM products p
        WHERE p.merchant_id = merchant_id_param
          AND p.status = 'active'
          AND to_tsvector('english',
                COALESCE(p.name, '') || ' ' ||
                COALESCE(p.description, '') || ' ' ||
                COALESCE(p.specs, '') || ' ' ||
                COALESCE(p.specifications::text, '')
              )
              @@ plainto_tsquery('english', search_query)
        ORDER BY relevance DESC
        LIMIT result_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION smart_product_search IS 'Hybrid search: uses trigram for short queries and full-text (including specs) for longer queries.';
