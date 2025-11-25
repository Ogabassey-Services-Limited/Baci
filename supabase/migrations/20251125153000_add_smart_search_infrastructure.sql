-- Add Smart Search Infrastructure
-- This migration adds:
-- 1. pg_trgm extension for fuzzy matching
-- 2. Full-text search indexes
-- 3. Trigram indexes for typo tolerance
-- 4. Smart search function that chooses best method
-- 5. Spelling correction function

-- ============================================================================
-- PART 1: Enable Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- PART 2: Create Search Indexes
-- ============================================================================

-- Full-text search index (fast for word-based search)
CREATE INDEX IF NOT EXISTS products_fts_idx ON products
USING GIN (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')));

-- Trigram index on product name (for typo tolerance on short queries)
CREATE INDEX IF NOT EXISTS products_name_trigram_idx ON products
USING gin (name gin_trgm_ops);

-- Trigram index on category (for category search with typos)
CREATE INDEX IF NOT EXISTS products_category_trigram_idx ON products
USING gin (category gin_trgm_ops);

-- Compound index for merchant + status filtering
CREATE INDEX IF NOT EXISTS products_merchant_status_idx ON products(merchant_id, is_active)
WHERE is_active = true;

-- ============================================================================
-- PART 3: Smart Search Function (Hybrid: FTS + Trigram)
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
            p.image_small,
            p.image_large,
            p.category,
            similarity(p.name, search_query)::REAL as relevance
        FROM products p
        WHERE p.merchant_id = merchant_id_param
          AND p.is_active = true
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
            p.image_small,
            p.image_large,
            p.category,
            ts_rank(
                to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')),
                plainto_tsquery('english', search_query)
            )::REAL as relevance
        FROM products p
        WHERE p.merchant_id = merchant_id_param
          AND p.is_active = true
          AND to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, ''))
              @@ plainto_tsquery('english', search_query)
        ORDER BY relevance DESC
        LIMIT result_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 4: Autocomplete Function (Fast prefix matching)
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
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 5: Spelling Correction Function ("Did You Mean?")
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
      AND p.is_active = true
      AND similarity(p.name, search_term) > similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 6: Search Analytics Table (Track what users search for)
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    results_count INT DEFAULT 0,
    clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    clicked_position INT, -- Which position in results was clicked
    search_method TEXT CHECK (search_method IN ('client', 'server', 'autocomplete')),
    user_session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX search_analytics_merchant_idx ON search_analytics(merchant_id);
CREATE INDEX search_analytics_query_idx ON search_analytics(search_query);
CREATE INDEX search_analytics_created_idx ON search_analytics(created_at DESC);

-- Enable RLS
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own search analytics"
    ON search_analytics FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
    ));

CREATE POLICY "Anyone can insert search analytics"
    ON search_analytics FOR INSERT
    WITH CHECK (true); -- Allow anonymous search tracking

-- ============================================================================
-- PART 7: Popular Searches View (For autocomplete suggestions)
-- ============================================================================

CREATE OR REPLACE VIEW popular_searches AS
SELECT
    merchant_id,
    search_query,
    COUNT(*) as search_count,
    AVG(results_count) as avg_results,
    COUNT(clicked_product_id)::DECIMAL / COUNT(*)::DECIMAL as click_through_rate
FROM search_analytics
WHERE created_at > NOW() - INTERVAL '30 days'
  AND results_count > 0
GROUP BY merchant_id, search_query
HAVING COUNT(*) > 3  -- Only queries searched multiple times
ORDER BY search_count DESC;

-- Grant access
GRANT SELECT ON popular_searches TO anon, authenticated;

-- ============================================================================
-- PART 8: Helper Function - Get Product Count (For threshold detection)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_merchant_product_count(merchant_id_param UUID)
RETURNS INT AS $$
    SELECT COUNT(*)::INT
    FROM products
    WHERE merchant_id = merchant_id_param
      AND is_active = true;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION smart_product_search IS 'Hybrid search: uses trigram for short queries (<4 chars) and full-text for longer queries';
COMMENT ON FUNCTION product_autocomplete IS 'Fast prefix matching for autocomplete dropdown';
COMMENT ON FUNCTION find_spelling_suggestion IS 'Finds similar product names for "Did you mean?" feature';
COMMENT ON TABLE search_analytics IS 'Tracks all search queries to improve search quality and provide insights';
