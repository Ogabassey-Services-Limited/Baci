CREATE OR REPLACE FUNCTION public.find_product_search_suggestion_v2(
  search_term text,
  merchant_id_param uuid,
  similarity_threshold real DEFAULT 0.35
) RETURNS TABLE(suggested_term text, similarity_score real)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
ROWS 1
AS $$
DECLARE
  -- show_limit() both initializes pg_trgm on a fresh backend and returns the
  -- exact internal real value (current_setting() exposes rounded text).
  current_trigram_threshold real := extensions.show_limit();
BEGIN
  IF similarity_threshold > 0
    AND similarity_threshold >= current_trigram_threshold
  THEN
    -- Here `%` is a lossless index prefilter: its current GUC threshold cannot
    -- exclude any score accepted by the requested threshold.
    RETURN QUERY
    WITH query_terms AS MATERIALIZED (
      SELECT
        public.normalize_product_search_text(search_term) AS normalized_query,
        public.compact_product_search_text(search_term) AS compact_query
    ),
    scored_candidates AS MATERIALIZED (
      SELECT
        product.name AS suggested_term,
        GREATEST(
          extensions.similarity(
            product.search_name_norm,
            query.normalized_query
          ),
          extensions.similarity(
            product.search_name_compact,
            query.compact_query
          )
        )::real AS similarity_score
      FROM public.products AS product
      CROSS JOIN query_terms AS query
      WHERE product.merchant_id = merchant_id_param
        AND product.status = 'active'
        AND (
          product.search_name_norm
            OPERATOR(extensions.%) query.normalized_query
          OR product.search_name_compact
            OPERATOR(extensions.%) query.compact_query
        )
    )
    SELECT scored.suggested_term, scored.similarity_score
    FROM scored_candidates AS scored
    WHERE scored.similarity_score >= similarity_threshold
    ORDER BY scored.similarity_score DESC, scored.suggested_term
    LIMIT 1;
  ELSE
    -- Positive thresholds below the current GUC, zero, negative, and NULL all
    -- require the legacy merchant-scoped scan to preserve exact semantics.
    RETURN QUERY
    WITH query_terms AS MATERIALIZED (
      SELECT
        public.normalize_product_search_text(search_term) AS normalized_query,
        public.compact_product_search_text(search_term) AS compact_query
    ),
    scored_candidates AS MATERIALIZED (
      SELECT
        product.name AS suggested_term,
        GREATEST(
          extensions.similarity(
            product.search_name_norm,
            query.normalized_query
          ),
          extensions.similarity(
            product.search_name_compact,
            query.compact_query
          )
        )::real AS similarity_score
      FROM public.products AS product
      CROSS JOIN query_terms AS query
      WHERE product.merchant_id = merchant_id_param
        AND product.status = 'active'
    )
    SELECT scored.suggested_term, scored.similarity_score
    FROM scored_candidates AS scored
    WHERE scored.similarity_score >= similarity_threshold
    ORDER BY scored.similarity_score DESC, scored.suggested_term
    LIMIT 1;
  END IF;
END;
$$;
