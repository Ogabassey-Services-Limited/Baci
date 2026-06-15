-- Migration: Fix search functions to use status instead of is_active
-- Created: 2025-11-26
-- Description: Updates all search functions that reference the dropped is_active column
-- The is_active column was replaced by the status enum in migration 20251125170000

-- ============================================================================
-- PART 1: Drop and recreate index using status column
-- ============================================================================

DROP INDEX IF EXISTS products_merchant_status_idx;

CREATE INDEX IF NOT EXISTS products_merchant_status_idx ON products(merchant_id, status)
WHERE status = 'active';

-- ============================================================================
-- PART 2: Fix smart_product_search function
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
            (p.images->0->>'small')::TEXT as image_small,
            (p.images->0->>'large')::TEXT as image_large,
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
            (p.images->0->>'small')::TEXT as image_small,
            (p.images->0->>'large')::TEXT as image_large,
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

-- ============================================================================
-- PART 3: Fix product_autocomplete function
-- ============================================================================

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
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.category,
        p.price,
        (p.images->0->>'small')::TEXT as image_small
    FROM products p
    WHERE p.merchant_id = merchant_id_param
      AND p.status = 'active'
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
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 4: Fix find_spelling_suggestion function
-- ============================================================================

CREATE OR REPLACE FUNCTION find_spelling_suggestion(
    search_term TEXT,
    merchant_id_param UUID,
    similarity_threshold REAL DEFAULT 0.3
) RETURNS TABLE (
    suggested_term TEXT,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.name as suggested_term,
        similarity(p.name, search_term)::REAL as similarity_score
    FROM products p
    WHERE p.merchant_id = merchant_id_param
      AND p.status = 'active'
      AND similarity(p.name, search_term) > similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 5: Fix get_merchant_product_count function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_merchant_product_count(merchant_id_param UUID)
RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM products
    WHERE merchant_id = merchant_id_param
      AND status = 'active';
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION smart_product_search IS 'Hybrid search: uses trigram for short queries (<4 chars) and full-text for longer queries. Uses status column.';
COMMENT ON FUNCTION product_autocomplete IS 'Fast prefix matching for autocomplete dropdown. Uses status column.';
COMMENT ON FUNCTION find_spelling_suggestion IS 'Finds similar product names for "Did you mean?" feature. Uses status column.';
COMMENT ON FUNCTION get_merchant_product_count IS 'Returns count of active products for a merchant. Uses status column.';
